export function groupBlobNamesByDate(blobNames: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};

  for (const blobName of blobNames) {
    const parts = blobName.split('/');
    let year = '';
    let month = '';
    let day = '';

    if (parts.length >= 4 && parts[0] === 'raw-log') {
      year = parts[1];
      month = parts[2];
      day = parts[3];
    } else if (parts.length >= 3) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else {
      const today = new Date();
      year = String(today.getUTCFullYear());
      month = String(today.getUTCMonth() + 1).padStart(2, '0');
      day = String(today.getUTCDate()).padStart(2, '0');
    }

    const dateKey = `${year}-${month}-${day}`;
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(blobName);
  }

  return groups;
}
