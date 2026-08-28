export function encodePixelBuffer(value: unknown, expectedBytes: number): string {
  if (!(value instanceof Uint8Array) || value.byteLength !== expectedBytes) {
    throw new Error(`The native renderer returned an invalid pixel buffer; expected ${expectedBytes} bytes`);
  }
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("base64");
}
