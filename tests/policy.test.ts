import test from "node:test";
import assert from "node:assert/strict";
import {
  readCommand,
  redact,
  scriptReview,
  parseMetrics,
  remoteError,
  matchesCheck,
} from "../src/main/policy";

test("diagnostics append without-paging and preserve count-only", () => {
  assert.equal(readCommand("/ip dns print detail"), "/ip dns print");
  assert.equal(readCommand("/system identity print"), "/system identity print");
  assert.equal(
    readCommand("/queue tree print stats"),
    "/queue tree print stats without-paging",
  );
  assert.equal(
    readCommand("/ip hotspot active print count-only"),
    "/ip hotspot active print count-only",
  );
  assert.equal(
    readCommand('/ip hotspot user profile print detail where name="Dosen"'),
    '/ip hotspot user profile print detail where name="Dosen" without-paging',
  );
});
test("diagnostic boundary rejects mutation, scripting, export-to-file and subscriptions", () => {
  for (const command of [
    "/system reboot",
    "/ip route remove 0",
    "/ip route print; /system reboot",
    "/ip route print\n/system reboot",
    "/ip route print file=backup",
    "/log print follow",
    "/log print interval=1",
    "/ip route print where name=[/system reboot]",
    '/ip route print where name="$x"',
    '/ip route print where name="a\\\""',
    "/system script print",
    "/export show-sensitive",
  ])
    assert.throws(() => readCommand(command), command);
});
test("redacts credentials and private keys before storing evidence", () => {
  const input =
    'password="hello world" ipsec-secret=sample\nprivate-key: abc\n-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----';
  const result = redact(input);
  for (const secret of ["hello world", "sample", "abc"])
    assert.equal(result.includes(secret), false);
  assert.match(result, /REDACTED/);
});
test("script review blocks destructive maintenance and credential-writing scripts", () => {
  for (const text of [
    "/system reboot",
    "/system reset-configuration",
    "/system scheduler add name=x",
    '/tool fetch url="https://example.org"',
    "/ip hotspot user add password=sample",
  ])
    assert.throws(() => scriptReview(text));
  assert.ok(
    scriptReview(
      "# AGENT-example\n/ip route add dst-address=192.0.2.0/24 gateway=192.0.2.1",
    ).length,
  );
});
test("parse missing measurements as missing, not zero or healthy", () => {
  assert.deepEqual(parseMetrics({}).cpu, undefined);
  assert.equal(parseMetrics({ "hotspot-active-count": "0" }).activeUsers, 0);
  assert.equal(
    parseMetrics({
      resource: " cpu-load: 62%\n version: 6.49.19\n free-memory: 900MiB",
    }).cpu,
    62,
  );
});
test("target verification checks both required and forbidden fields", () => {
  const c = {
    command: "/ip hotspot user profile print",
    contains: ['name="student"'],
    notContains: ["rate-limit="],
  };
  assert.equal(matchesCheck('name="student" rate-limit="2M/8M"', c), false);
  assert.equal(matchesCheck('name="student"', c), true);
  assert.equal(remoteError("failure: import interrupted"), true);
  assert.equal(
    remoteError("Script file loaded and executed successfully"),
    false,
  );
});
