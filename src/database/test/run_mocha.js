const fs = require('fs');
const path = require('path');
const Mocha = require('mocha');

const TEST_DIR = path.join(__dirname);
const DEFAULT_TIMEOUT_MS = 30000;

function normalizeInputToFile(arg) {
  if (!arg) return null;

  const hasJsExtension = arg.endsWith('.js');
  const candidateName = hasJsExtension ? arg : `${arg}.js`;

  const candidates = [
    path.resolve(process.cwd(), candidateName),
    path.resolve(process.cwd(), 'database', 'test', candidateName),
    path.resolve(TEST_DIR, candidateName)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function listDefaultTestFiles() {
  return fs
    .readdirSync(TEST_DIR)
    .filter((file) => file.endsWith('.js') && file !== 'run_mocha.js')
    .map((file) => path.join(TEST_DIR, file));
}

function main() {
  const args = process.argv.slice(2);
  const mocha = new Mocha({
    timeout: DEFAULT_TIMEOUT_MS,
    reporter: 'spec'
  });

  if (args.length > 0) {
    const requested = normalizeInputToFile(args[0]);

    if (!requested) {
      console.error(`Test file not found: ${args[0]}`);
      process.exit(1);
    }

    mocha.addFile(requested);
  } else {
    const files = listDefaultTestFiles();

    if (files.length === 0) {
      console.error('No test files found under database/test');
      process.exit(1);
    }

    files.forEach((file) => mocha.addFile(file));
  }

  mocha.run((failures) => {
    process.exitCode = failures ? 1 : 0;
  });
}

main();
