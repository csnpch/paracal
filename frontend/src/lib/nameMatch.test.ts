import { describe, expect, it } from 'vitest';
import { findEmployeeByAuthorName, namesMatch } from './nameMatch';

describe('namesMatch', () => {
  it('matches exact and contained names', () => {
    expect(namesMatch('John Smith', 'john smith')).toBe(true);
    expect(namesMatch('Somchai Jaidee', 'Somchai')).toBe(true);
  });

  it('matches token overlap above threshold', () => {
    expect(namesMatch('Chitsanuphong Cha', 'Chitsanuphong C')).toBe(true);
  });

  it('rejects clearly different names', () => {
    expect(namesMatch('Alice Wonder', 'Bob Builder')).toBe(false);
  });
});

describe('findEmployeeByAuthorName', () => {
  const employees = [
    { id: 1, name: 'Chitsanuphong Cha' },
    { id: 2, name: 'Jane Doe' },
  ];

  it('finds employee by fuzzy author name', () => {
    expect(findEmployeeByAuthorName('chitsanuphong cha', employees)?.id).toBe(1);
  });
});
