export const abbreviateNumber = (value: number) => {
    const suffixes = ['', 'K', 'M', 'B', 'T'];
    if (value < 1000) return value.toString(); // No abbreviation for values less than 1000

    const suffixNum = Math.floor(Math.log10(value) / 3);
    const suffix = suffixes[suffixNum] || '';

    const shortValue = value / Math.pow(1000, suffixNum);

    if (shortValue >= 100) {
        return Math.round(shortValue) + suffix;
    }

    return shortValue.toFixed(1).replace(/\.0$/, '') + suffix;
};