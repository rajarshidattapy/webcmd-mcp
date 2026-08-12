import assert from "node:assert/strict";
import { readFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { clip, exec, isSkillName } from "./server.js";

// clip: passthrough under the limit, head+tail above it
assert.equal(clip("short"), "short");
const big = clip("x".repeat(100000));
assert.ok(big.length < 100000 && big.includes("truncated 40000 chars"));

// exec: exit code, stdout, stderr, missing binary, timeout
assert.deepEqual(
  await exec(process.execPath, ["-e", "console.log('hi')"]),
  { code: 0, out: "hi\n", err: "" },
);
const failed = await exec(process.execPath, ["-e", "console.error('bad');process.exit(3)"]);
assert.equal(failed.code, 3);
assert.match(failed.err, /bad/);
assert.equal((await exec("definitely-not-a-real-binary-xyz", [])).code, -1);
const eof = await exec(
  process.execPath,
  ["-e", "require('fs').readFileSync(0); console.log('eof')"],
  { timeout: 2000 },
);
assert.equal(eof.code, 0);
assert.match(eof.out, /eof/);
const slow = await exec(process.execPath, ["-e", "setInterval(()=>{},1000)"], { timeout: 300 });
assert.match(slow.err, /timed out/);

// timeout must kill grandchildren (cmd shim / browser children), not just the top PID
const marker = path.join(os.tmpdir(), `webcmd-mcp-grandchild-${process.pid}`);
try {
  unlinkSync(marker);
} catch {
  // no leftover
}
const nested = await exec(
  process.execPath,
  [
    "-e",
    `const {spawn}=require('child_process');const fs=require('fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(marker)},String(c.pid));setInterval(()=>{},1000);`,
  ],
  { timeout: 400 },
);
assert.match(nested.err, /timed out/);
const grandchildPid = Number(readFileSync(marker, "utf8"));
assert.ok(grandchildPid > 0);
await new Promise((r) => setTimeout(r, 800));
let alive = true;
try {
  process.kill(grandchildPid, 0);
} catch {
  alive = false;
}
assert.equal(alive, false);
try {
  unlinkSync(marker);
} catch {
  // ignore
}

// end to end over stdio: the three tools are exposed and webcmd_run reaches the CLI
const client = new Client({ name: "test", version: "0" });
await client.connect(
  new StdioClientTransport({ command: process.execPath, args: ["server.js"] }),
);
const names = (await client.listTools()).tools.map((t) => t.name).sort();
assert.deepEqual(names, ["webcmd_run", "webcmd_setup", "webcmd_skill"]);

const version = await client.callTool({ name: "webcmd_run", arguments: { args: ["--version"] } });
assert.match(version.content[0].text, /\d+\.\d+\.\d+/);

assert.equal(isSkillName("webcmd-usage"), true);
assert.equal(isSkillName(".."), false);
assert.equal(isSkillName("../secrets"), false);
assert.equal(isSkillName("..\\secrets"), false);
assert.equal(isSkillName("foo/bar"), false);
assert.equal(isSkillName("foo\\bar"), false);

const unknown = await client.callTool({ name: "webcmd_skill", arguments: { name: "nope" } });
assert.equal(unknown.isError, true);

const traversal = await client.callTool({
  name: "webcmd_skill",
  arguments: { name: "../.ssh" },
});
assert.equal(traversal.isError, true);
assert.match(traversal.content[0].text, /Invalid skill name/);

const usage = await client.callTool({ name: "webcmd_skill", arguments: { name: "webcmd-usage" } });
assert.match(usage.content[0].text, /name: webcmd-usage/);

await client.close();
console.log("ok");
