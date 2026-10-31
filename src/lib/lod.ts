export function decodeLod(buf: Buffer): number[] {
  const copy = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return Array.from(new Float64Array(copy));
}
