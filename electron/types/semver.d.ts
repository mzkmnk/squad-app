declare module 'semver' {
  export function parse(version: string): any;
  export function compare(a: any, b: any): number;
}
