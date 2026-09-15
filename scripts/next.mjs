import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";

const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const nodeArguments = [];
nodeArguments.push(nextBin, ...process.argv.slice(2));

const childEnvironment = { ...process.env };
if (Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10) >= 22) {
  childEnvironment.NODE_USE_SYSTEM_CA = "1";
}

if (childEnvironment.NODE_OPTIONS) {
  childEnvironment.NODE_OPTIONS = childEnvironment.NODE_OPTIONS
    .replace(/(?:^|\s)--use-system-ca(?=\s|$)/g, " ")
    .trim();
  if (!childEnvironment.NODE_OPTIONS) {
    delete childEnvironment.NODE_OPTIONS;
  }
}

const child = spawn(process.execPath, nodeArguments, {
  env: childEnvironment,
  stdio: "inherit",
  windowsVerbatimArguments: false,
});

child.on("close", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
