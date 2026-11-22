import { darkColors, lightColors, type ColorScheme } from '@dinsdelparc/shared';

const vars = (c: ColorScheme) =>
  Object.entries(c)
    .map(([k, v]) => `--${k}:${v};`)
    .join('');

/** CSS variables generated from the shared design tokens (single source of truth). */
export function themeCss(): string {
  return [
    `:root{${vars(lightColors)}color-scheme:light;}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars(darkColors)}color-scheme:dark;}}`,
    `:root[data-theme="dark"]{${vars(darkColors)}color-scheme:dark;}`,
    `:root[data-theme="light"]{${vars(lightColors)}color-scheme:light;}`,
  ].join('\n');
}
