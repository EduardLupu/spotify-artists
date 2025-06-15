export interface City {
    n: string; // City name
    c: string; // Country name
    l: number; // Latitude coordinate
    L: number; // Longitude coordinate
}

export interface Cities {
    cities: City[]; // Array of cities
}