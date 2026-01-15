import { GoogleAutocompleteSuggestion } from "./auth";


export interface PlacePrediction {
    place_id: string;
    description: string;
    main_text: string;
    secondary_text: string;
}

export interface LocationData {
    lat: number;
    lng: number;
    address: string;
}
let sessionToken: Window['google']['maps']['places']['AutocompleteSessionToken'] | null = null;
/**
 * Create or get a session token for autocomplete requests
 * Session tokens are used to group autocomplete queries and selections into sessions
 * for better analytics and cost optimization
 */
function getSessionToken(): Window['google']['maps']['places']['AutocompleteSessionToken'] {
    if (!sessionToken) {
        sessionToken = new window.google.maps.places.AutocompleteSessionToken();
    }
    return sessionToken;
}
/**
 * Reset the session token after a place is selected
 */

export function resetSessionToken(): void {
    sessionToken = null;
}
/**
 * Get place predictions using the modern AutocompleteSuggestion API
 */

export async function getPlacePredictions(input: string): Promise<PlacePrediction[]> {
    try {
        if (!(window as any).google?.maps) {
            throw new Error('Google Maps API not loaded');
        }

        // Dynamically import the places library
        const { AutocompleteSuggestion } = await ((window as any).google.maps as any).importLibrary('places');

        const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input,
            sessionToken: getSessionToken(),
            // Optional: Add region codes or primary types filtering
            // includedRegionCodes: ['us'],
            // includedPrimaryTypes: ['locality'],
        });

        console.log('API Suggestions response:', suggestions);

        // Convert API response to our interface
        return (suggestions || []).map((suggestion: GoogleAutocompleteSuggestion) => {
            console.log('Individual suggestion keys:', Object.keys(suggestion));
            console.log('Individual suggestion:', suggestion);

            // The new API uses a different structure - try to get place prediction
            let placeId = '';
            let mainText = '';
            let secondaryText = '';

            // Try to access placePrediction which contains the actual place info
            if (suggestion.placePrediction) {
                placeId = suggestion.placePrediction.placeId || '';
                mainText = typeof suggestion.mainText === 'string' ? suggestion.mainText : suggestion.mainText?.text || '';
                secondaryText = typeof suggestion.secondaryText === 'string' ? suggestion.secondaryText : suggestion.secondaryText?.text || '';
            } else {
                // Fallback to direct properties
                placeId = suggestion.placeId || suggestion.id || '';
                mainText = typeof suggestion.mainText === 'string' ? suggestion.mainText : suggestion.mainText?.text || '';
                secondaryText = typeof suggestion.secondaryText === 'string' ? suggestion.secondaryText : suggestion.secondaryText?.text || '';
            }

            console.log('Extracted:', { placeId, mainText, secondaryText });

            return {
                place_id: placeId,
                description: secondaryText ? `${mainText} ${secondaryText}` : mainText,
                main_text: mainText,
                secondary_text: secondaryText,
            };
        });
    } catch (error) {
        console.error('Failed to fetch autocomplete suggestions:', error);
        return [];
    }
}
/**
 * Get place details using the modern Place API
 */

export async function getPlaceDetails(placeId: string): Promise<LocationData | null> {
    try {
        if (!(window as any).google?.maps) {
            throw new Error('Google Maps API not loaded');
        }

        console.log('Fetching details for placeId:', placeId);

        // Dynamically import the places library
        const { Place } = await ((window as any).google.maps as any).importLibrary('places');

        // Create a Place instance
        const place = new Place({ id: placeId });

        // Request the correct fields for the new API
        // Valid fields: location, formattedAddress, displayName, etc.
        await place.fetchFields({
            fields: ['location', 'formattedAddress', 'displayName'],
            sessionToken: getSessionToken(),
        });

        console.log('Place data fetched:', place);

        // Reset session token after place is selected
        resetSessionToken();

        // Extract location from the Place object
        const location = place.location;
        if (location) {
            const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
            const lng = typeof location.lng === 'function' ? location.lng() : location.lng;

            console.log('Location extracted:', { lat, lng });

            return {
                lat,
                lng,
                address: place.formattedAddress || place.displayName?.text || '',
            };
        } else {
            console.warn('No location found in place:', place);
            return null;
        }
    } catch (error) {
        console.error('Failed to fetch place details:', error);
        console.error('Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        return null;
    }
}
