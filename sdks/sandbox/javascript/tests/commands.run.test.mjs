import assert from "node:assert/strict";
import test from "node:test";

import { CommandsAdapter } from "../dist/internal.js";

function createAdapter(responseBody, opts = {}) {
  const fetchImpl = async () =>
    new Response(responseBody, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });

  return new CommandsAdapter(
    {},
    {
      baseUrl: "http://127.0.0.1:8080",
      fetch: fetchImpl,
      headers: opts.headers,
    },
  );
}

test("CommandsAdapter.run populates complete and exitCode for successful foreground commands", async () => {
  const adapter = createAdapter(
    [
      'data: {"type":"init","text":"cmd-1","timestamp":1}',
      'data: {"type":"stdout","text":"hi","timestamp":2}',
      'data: {"type":"execution_complete","timestamp":3,"execution_time":4}',
      "",
    ].join("\n"),
  );

  const execution = await adapter.run("echo hi");

  assert.equal(execution.id, "cmd-1");
  assert.equal(execution.logs.stdout[0].text, "hi");
  assert.equal(execution.complete?.executionTimeMs, 4);
  assert.equal(execution.exitCode, 0);
});

test("CommandsAdapter.run infers non-zero exitCode from final error state", async () => {
  const adapter = createAdapter(
    [
      'data: {"type":"init","text":"cmd-2","timestamp":1}',
      'data: {"type":"error","error":{"ename":"CommandExecError","evalue":"7","traceback":["exit status 7"]},"timestamp":2}',
      "",
    ].join("\n"),
  );

  const execution = await adapter.run("exit 7");

  assert.equal(execution.id, "cmd-2");
  assert.equal(execution.error?.value, "7");
  assert.equal(execution.complete, undefined);
  assert.equal(execution.exitCode, 7);
});

test("CommandsAdapter.run keeps exitCode null when error value is empty", async () => {
  const adapter = createAdapter(
    [
      'data: {"type":"init","text":"cmd-3","timestamp":1}',
      'data: {"type":"execution_complete","timestamp":2,"execution_time":4}',
      'data: {"type":"error","error":{"ename":"CommandExecError","evalue":"","traceback":["failed"]},"timestamp":3}',
      "",
    ].join("\n"),
  );

  const execution = await adapter.run("bad command");

  assert.equal(execution.id, "cmd-3");
  assert.equal(execution.error?.value, "");
  assert.equal(execution.complete?.executionTimeMs, 4);
  assert.equal(execution.exitCode, null);
});
