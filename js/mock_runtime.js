// A simple runtime that doesn't involve typescript or protobufs to test
// libdeno. Invoked by mock_runtime_test.cc

const global = this;

function assert(cond) {
  if (!cond) throw Error("mock_runtime.js assert failed");
}

global.CanCallFunction = () => {
  deno.print("Hello world from foo");
  return "foo";
};

// This object is created to test snapshotting.
// See DeserializeInternalFieldsCallback and SerializeInternalFieldsCallback.
const snapshotted = new Uint8Array([1, 3, 3, 7]);

global.TypedArraySnapshots = () => {
  assert(snapshotted[0] === 1);
  assert(snapshotted[1] === 3);
  assert(snapshotted[2] === 3);
  assert(snapshotted[3] === 7);
};

global.SendSuccess = () => {
  deno.recv(msg => {
    deno.print("SendSuccess: ok");
  });
};

global.SendByteLength = () => {
  deno.recv(msg => {
    assert(msg instanceof ArrayBuffer);
    assert(msg.byteLength === 3);
  });
};

global.RecvReturnEmpty = () => {
  const m1 = new Uint8Array("abc".split("").map(c => c.charCodeAt(0)));
  const m2 = m1.slice();
  const r1 = deno.send(m1);
  assert(r1 == null);
  const r2 = deno.send(m2);
  assert(r2 == null);
};

global.RecvReturnBar = () => {
  const m = new Uint8Array("abc".split("").map(c => c.charCodeAt(0)));
  const r = deno.send(m);
  assert(r instanceof Uint8Array);
  assert(r.byteLength === 3);
  const rstr = String.fromCharCode(...r);
  assert(rstr === "bar");
};

global.DoubleRecvFails = () => {
  // deno.recv is an internal function and should only be called once from the
  // runtime.
  deno.recv((channel, msg) => assert(false));
  deno.recv((channel, msg) => assert(false));
};

global.SendRecvSlice = () => {
  const abLen = 1024;
  let buf = new Uint8Array(abLen);
  for (let i = 0; i < 5; i++) {
    // Set first and last byte, for verification by the native side.
    buf[0] = 100 + i;
    buf[buf.length - 1] = 100 - i;
    // On the native side, the slice is shortened by 19 bytes.
    buf = deno.send(buf);
    assert(buf.byteOffset === i * 11);
    assert(buf.byteLength === abLen - i * 30 - 19);
    assert(buf.buffer.byteLength == abLen);
    // Look for values written by the backend.
    assert(buf[0] === 200 + i);
    assert(buf[buf.length - 1] === 200 - i);
    // On the JS side, the start of the slice is moved up by 11 bytes.
    buf = buf.subarray(11);
    assert(buf.byteOffset === (i + 1) * 11);
    assert(buf.byteLength === abLen - (i + 1) * 30);
  }
};

global.JSSendArrayBufferViewTypes = () => {
  // Test that ArrayBufferView slices are transferred correctly.
  // Send Uint8Array.
  const ab1 = new ArrayBuffer(4321);
  const u8 = new Uint8Array(ab1, 2468, 1000);
  u8[0] = 1;
  deno.send(u8);
  // Send Uint32Array.
  const ab2 = new ArrayBuffer(4321);
  const u32 = new Uint32Array(ab2, 2468, 1000 / Uint32Array.BYTES_PER_ELEMENT);
  u32[0] = 0x02020202;
  deno.send(u32);
  // Send DataView.
  const ab3 = new ArrayBuffer(4321);
  const dv = new DataView(ab3, 2468, 1000);
  dv.setUint8(0, 3);
  deno.send(dv);
};

global.JSSendNeutersBuffer = () => {
  // Buffer should be neutered after transferring it to the native side.
  const u8 = new Uint8Array([42]);
  assert(u8.byteLength === 1);
  assert(u8.buffer.byteLength === 1);
  assert(u8[0] === 42);
  const r = deno.send(u8);
  assert(u8.byteLength === 0);
  assert(u8.buffer.byteLength === 0);
  assert(u8[0] === undefined);
};

// The following join has caused SnapshotBug to segfault when using kKeep.
[].join("");

global.SnapshotBug = () => {
  assert("1,2,3" === String([1, 2, 3]));
};

global.ErrorHandling = () => {
  global.onerror = (message, source, line, col, error) => {
    deno.print(`line ${line} col ${col}`);
    assert("ReferenceError: notdefined is not defined" === message);
    assert(source === "helloworld.js");
    assert(line === 3);
    assert(col === 1);
    assert(error instanceof Error);
    deno.send(new Uint8Array([42]));
  };
  eval("\n\n notdefined()\n//# sourceURL=helloworld.js");
};
