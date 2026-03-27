/**
 * Maschera un indirizzo email per i log
 * es. mario.rossi@gmail.com → ma***@gmail.com
 */
export function maskEmail(email: string | null | undefined): string {
    if (!email) return 'N/A';
    return email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
}

/**
 * Maschera un nome per i log
 * es. Mario Rossi → M*** R***
 */
export function maskName(name: string | null | undefined): string {
    if (!name) return 'N/A';
    return name
        .split(' ')
        .map(part => part.length > 0 ? part[0] + '***' : '')
        .join(' ');
}

/**
 * Maschera un numero di telefono per i log
 * es. +39 333 1234567 → +39 333 ***4567
 */
export function maskPhone(phone: string | null | undefined): string {
    if (!phone) return 'N/A';
    return phone.replace(/.(?=.{4})/g, '*');
}
