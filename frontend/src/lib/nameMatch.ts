const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenOverlapScore = (a: string, b: string): number => {
  const tokensA = a.split(' ').filter(Boolean);
  const tokensB = b.split(' ').filter(Boolean);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const matched = tokensA.filter((tokenA) =>
    tokensB.some((tokenB) => tokenA.includes(tokenB) || tokenB.includes(tokenA)),
  ).length;

  return matched / Math.max(tokensA.length, tokensB.length);
};

const characterContainmentScore = (a: string, b: string): number => {
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (!shorter) return 0;
  if (longer.includes(shorter)) return shorter.length / longer.length;

  let matched = 0;
  const longerChars = longer.split('');
  for (const char of shorter) {
    const index = longerChars.indexOf(char);
    if (index >= 0) {
      matched += 1;
      longerChars.splice(index, 1);
    }
  }

  return matched / shorter.length;
};

/** Returns true when two display names likely refer to the same person (>= 80% overlap). */
export const namesMatch = (left: string, right: string, threshold = 0.8): boolean => {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;

  const score = Math.max(
    tokenOverlapScore(normalizedLeft, normalizedRight),
    characterContainmentScore(normalizedLeft, normalizedRight),
  );

  return score >= threshold;
};

export const findEmployeeByAuthorName = <T extends { id: number; name: string }>(
  authorName: string,
  employees: T[],
): T | undefined => employees.find((employee) => namesMatch(authorName, employee.name));
