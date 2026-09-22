declare module 'topojson-simplify' {
  export function presimplify(topology: any, weight?: (...args: any[]) => number): any;
  export function simplify(topology: any, minWeight?: number): any;
  export function quantile(topology: any, p: number): number;
  export function filter(topology: any, filter?: (...args: any[]) => boolean): any;
}
