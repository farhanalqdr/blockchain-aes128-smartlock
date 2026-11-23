const fs = require('fs');
const path = require('path');

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (const arg of args) {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    parsed[key] = rest.join('=').replace(/^"|"$/g, '');
  }

  return parsed;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function normalizeIsoFraction(value) {
  return String(value).replace(/\.(\d{3})\d+/, '.$1');
}

function parseCustomUTC7(value) {
  const match = String(value).trim().match(
    /^([A-Za-z]{3})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\s+UTC\+07$/i
  );

  if (!match) return null;

  const [, monthText, dayText, yearText, hourText, minuteText, secondText, ampm] = match;

  const monthIndex = MONTHS.findIndex(
    (month) => month.toLowerCase() === monthText.toLowerCase()
  );

  if (monthIndex < 0) return null;

  let hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);

  if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;

  const year = Number(yearText);
  const day = Number(dayText);

  // Input is UTC+07, convert to real UTC Date.
  return new Date(Date.UTC(year, monthIndex, day, hour - 7, minute, second));
}

function parseDateFlexible(value) {
  if (!value) return null;

  const customDate = parseCustomUTC7(value);
  if (customDate && !Number.isNaN(customDate.getTime())) {
    return customDate;
  }

  const normalized = normalizeIsoFraction(String(value).trim());
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function formatUTC7(value) {
  const date = value instanceof Date ? value : parseDateFlexible(value);

  if (!date || Number.isNaN(date.getTime())) return '';

  const utc7 = new Date(date.getTime() + 7 * 60 * 60 * 1000);

  const month = MONTHS[utc7.getUTCMonth()];
  const day = pad(utc7.getUTCDate());
  const year = utc7.getUTCFullYear();

  let hour = utc7.getUTCHours();
  const minute = pad(utc7.getUTCMinutes());
  const second = pad(utc7.getUTCSeconds());

  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${month}-${day}-${year} ${pad(hour)}:${minute}:${second} ${ampm} UTC+07`;
}

function diffMs(endValue, startValue) {
  const end = parseDateFlexible(endValue);
  const start = parseDateFlexible(startValue);

  if (!end || !start) return '';

  return end.getTime() - start.getTime();
}

function csvEscape(value) {
  if (value === null || typeof value === 'undefined') return '';

  const stringValue = String(value);

  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && next === '\n') i += 1;

      row.push(current);
      current = '';

      if (row.some((cell) => cell.trim() !== '')) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    current += char;
  }

  if (current || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell.trim() !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

function readClickCsv(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(raw);

  if (rows.length < 2) {
    throw new Error('CSV tidak memiliki data.');
  }

  const header = rows[0].map((cell) => cell.trim());

  return rows.slice(1).map((row) => {
    const item = {};

    header.forEach((column, index) => {
      item[column] = row[index] || '';
    });

    return item;
  });
}

function parseJournalTimestamp(line) {
  const match = String(line).match(/^(\d{4}-\d{2}-\d{2}T[^\s]+)\s+/);

  if (!match) return null;

  return parseDateFlexible(match[1]);
}

function parseRaspberryLog(logPath) {
  const raw = fs.readFileSync(logPath, 'utf8');
  const lines = raw.split(/\r?\n/);

  const byCommandId = new Map();
  let currentCommandId = null;

  for (const line of lines) {
    const timestamp = parseJournalTimestamp(line);
    if (!timestamp) continue;

    const processMatch = line.match(/\[PROCESS\]\s*Command ID:\s*([a-fA-F0-9]+)/i);

    if (processMatch) {
      currentCommandId = processMatch[1];

      if (!byCommandId.has(currentCommandId)) {
        byCommandId.set(currentCommandId, {
          commandId: currentCommandId,
          raspiReceivedAt: timestamp,
          relayActivatedAt: null,
          relayActivatedFallbackAt: null,
          relayLine: '',
          relaySource: ''
        });
      }

      const record = byCommandId.get(currentCommandId);

      if (!record.raspiReceivedAt) {
        record.raspiReceivedAt = timestamp;
      }

      continue;
    }

    if (!currentCommandId) continue;

    const record = byCommandId.get(currentCommandId);
    if (!record) continue;

    const lower = line.toLowerCase();

    const isHighConfidenceRelay =
      lower.includes('[gpio]') ||
      lower.includes('unlock pulse on') ||
      lower.includes('relay pulse on') ||
      lower.includes('relay activated');

    const isFallbackRelay =
      lower.includes('[hardware]') &&
      (
        lower.includes('unlock command') ||
        lower.includes('relay on') ||
        lower.includes('relay pulse')
      );

    if (isHighConfidenceRelay) {
      record.relayActivatedAt = timestamp;
      record.relayLine = line.trim();
      record.relaySource = 'GPIO / relay active log';
      continue;
    }

    if (isFallbackRelay && !record.relayActivatedFallbackAt) {
      record.relayActivatedFallbackAt = timestamp;
      record.relayLine = line.trim();
      record.relaySource = 'Fallback hardware log';
    }
  }

  for (const record of byCommandId.values()) {
    if (!record.relayActivatedAt && record.relayActivatedFallbackAt) {
      record.relayActivatedAt = record.relayActivatedFallbackAt;
    }
  }

  return byCommandId;
}

function getValue(row, possibleNames) {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== '') return row[name];
  }

  return '';
}

function getTxNumber(txLabel) {
  const match = String(txLabel || '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function main() {
  const args = parseArgs();

  const clickCsvPath = args.clickCsv ? path.resolve(args.clickCsv) : '';
  const raspiLogPath = args.raspiLog ? path.resolve(args.raspiLog) : '';
  const outputPath = args.output
    ? path.resolve(args.output)
    : path.resolve(process.cwd(), `latency-final-utc7-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);

  if (!clickCsvPath) {
    throw new Error('Parameter --clickCsv wajib diisi.');
  }

  if (!raspiLogPath) {
    throw new Error('Parameter --raspiLog wajib diisi.');
  }

  if (!fs.existsSync(clickCsvPath)) {
    throw new Error(`File CSV tidak ditemukan: ${clickCsvPath}`);
  }

  if (!fs.existsSync(raspiLogPath)) {
    throw new Error(`File log Raspberry tidak ditemukan: ${raspiLogPath}`);
  }

  const clickRows = readClickCsv(clickCsvPath);
  const raspiMap = parseRaspberryLog(raspiLogPath);

  const finalRows = clickRows.map((row) => {
    const txLabel = getValue(row, ['Tx ke-', 'Tx', 'txLabel']);
    const commandId = getValue(row, ['Command ID', 'commandId']);
    const commandType = getValue(row, ['Command Type', 'commandType']);
    const lockAddress = getValue(row, ['Lock Address', 'lockAddress']);
    const userClickedAt = getValue(row, ['User Clicked At', 'userClickedAt']);
    const backendResponseAt = getValue(row, ['Backend Response At', 'backendResponseAt']);
    const txHash = getValue(row, ['Tx Hash', 'txHash', 'Transaction Hash']);
    const blockNumber = getValue(row, ['Block Number', 'blockNumber']);
    const blockTimestamp = getValue(row, ['Block Timestamp', 'blockTimestamp']);
    const status = getValue(row, ['Status', 'status']);

    const raspi = raspiMap.get(commandId);

    const raspiReceivedAt = raspi?.raspiReceivedAt || '';
    const relayActivatedAt = raspi?.relayActivatedAt || '';

    const totalLatencyMs = relayActivatedAt && userClickedAt
      ? diffMs(relayActivatedAt, userClickedAt)
      : '';

    const raspiReceiveToRelayMs = relayActivatedAt && raspiReceivedAt
      ? diffMs(relayActivatedAt, raspiReceivedAt)
      : '';

    return {
      txLabel,
      commandId,
      commandType,
      lockAddress,
      userClickedAtUTC7: formatUTC7(userClickedAt),
      backendResponseAtUTC7: formatUTC7(backendResponseAt),
      raspiReceivedAtUTC7: formatUTC7(raspiReceivedAt),
      relayActivatedAtUTC7: formatUTC7(relayActivatedAt),
      totalLatencyMs,
      totalLatencySeconds: totalLatencyMs === '' ? '' : (Number(totalLatencyMs) / 1000).toFixed(3),
      raspiReceiveToRelayMs,
      txHash,
      blockNumber,
      blockTimestampUTC7: formatUTC7(blockTimestamp),
      status,
      matchStatus: raspi
        ? relayActivatedAt
          ? 'MATCHED'
          : 'MATCHED_NO_RELAY_TIMESTAMP'
        : 'COMMAND_ID_NOT_FOUND_IN_RASPI_LOG',
      relaySource: raspi?.relaySource || '',
      relayLogLine: raspi?.relayLine || ''
    };
  });

  finalRows.sort((a, b) => getTxNumber(a.txLabel) - getTxNumber(b.txLabel));

  const header = [
    'Tx ke-',
    'Command ID',
    'Command Type',
    'Lock Address',
    'User Clicked At UTC+07',
    'Raspi Received At UTC+07',
    'Relay Activated At UTC+07',
    'Total Latency (ms)',
    'Total Latency (s)',
    'Raspi Receive to Relay (ms)',
    'Backend Response At UTC+07',
    'Tx Hash',
    'Block Number',
    'Block Timestamp UTC+07',
    'Status',
    'Match Status',
    'Relay Source',
    'Relay Log Line'
  ];

  const csvLines = [header.join(',')];

  for (const item of finalRows) {
    csvLines.push([
      item.txLabel,
      item.commandId,
      item.commandType,
      item.lockAddress,
      item.userClickedAtUTC7,
      item.raspiReceivedAtUTC7,
      item.relayActivatedAtUTC7,
      item.totalLatencyMs,
      item.totalLatencySeconds,
      item.raspiReceiveToRelayMs,
      item.backendResponseAtUTC7,
      item.txHash,
      item.blockNumber,
      item.blockTimestampUTC7,
      item.status,
      item.matchStatus,
      item.relaySource,
      item.relayLogLine
    ].map(csvEscape).join(','));
  }

  fs.writeFileSync(outputPath, `${csvLines.join('\n')}\n`, 'utf8');

  const completed = finalRows.filter((row) => row.totalLatencyMs !== '');
  const latencyValues = completed.map((row) => Number(row.totalLatencyMs));

  const average = latencyValues.length > 0
    ? latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length
    : null;

  const min = latencyValues.length > 0 ? Math.min(...latencyValues) : null;
  const max = latencyValues.length > 0 ? Math.max(...latencyValues) : null;

  console.log('======================================');
  console.log('LATENCY FINAL CSV GENERATED');
  console.log('======================================');
  console.log('Click CSV      :', clickCsvPath);
  console.log('Raspberry Log  :', raspiLogPath);
  console.log('Output CSV     :', outputPath);
  console.log('Total Rows     :', finalRows.length);
  console.log('Completed Rows :', completed.length);
  console.log('Average Latency:', average === null ? '-' : `${average.toFixed(2)} ms`);
  console.log('Min Latency    :', min === null ? '-' : `${min} ms`);
  console.log('Max Latency    :', max === null ? '-' : `${max} ms`);
  console.log('======================================');
}

try {
  main();
} catch (error) {
  console.error('');
  console.error('Merge latency failed.');
  console.error(error.message);
  process.exitCode = 1;
}