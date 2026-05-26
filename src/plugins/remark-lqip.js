import { visit } from 'unist-util-visit';

export function remarkLqip(options = {}) {
  const { enable = true } = options;
  
  return async (tree) => {
    if (!enable) return;
  };
}
