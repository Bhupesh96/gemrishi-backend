// utils/parseArrayField.js
export const parseArrayField = (data, key, mapper) => {
  let parsed = [];

  if (!data[key]) return [];

  try {
    parsed = JSON.parse(data[key]); // handle stringified JSON
  } catch {
    parsed = data[key]; // already array
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.map(mapper);
};
