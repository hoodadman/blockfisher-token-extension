import { GLOSSARY, tooltipFor } from './glossary';

/** Short “what this check means” text, shown on every row’s tooltip. */
export const ABOUT: Readonly<Record<string, string>> = Object.fromEntries(
  Object.keys(GLOSSARY).map((id) => [id, tooltipFor(id)]),
);
