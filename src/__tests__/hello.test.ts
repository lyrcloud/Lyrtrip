import { describe, it, expect } from 'vitest';

describe('Hello World Tests', () => {
  it('should return true for true', () => {
    expect(true).toBe(true);
  });

  it('should add numbers correctly', () => {
    const result = 2 + 2;
    expect(result).toBe(4);
  });
});