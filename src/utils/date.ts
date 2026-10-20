const formatJstDate = (date: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(date);

export const todayJst = () => formatJstDate(new Date());

export const monthJst = () => todayJst().slice(0, 7);

export const dateAfterDaysJst = (days: number) => formatJstDate(new Date(Date.now() + days * 86400000));
