// declarations.d.ts
declare module "m3u8-parser" {
  export class Parser {
    constructor()
    push(data: string): void
    end(): void
    manifest: Manifest
  }
}
