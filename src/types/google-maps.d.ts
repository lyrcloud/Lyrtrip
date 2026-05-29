interface GoogleMapsOptions {
  center: { lat: number; lng: number };
  zoom: number;
}

interface GooglePlacesTextSearchRequest {
  query: string;
  type?: string;
}

interface GooglePlacesResult {
  name?: string;
  formatted_address?: string;
  rating?: number;
  place_id?: string;
  photos?: Array<{ getUrl: () => string }>;
  website?: string;
  formatted_phone_number?: string;
}

declare namespace google {
  namespace maps {
    class Map {
      constructor(element: HTMLElement, options: GoogleMapsOptions);
    }

    class Marker {
      constructor(options: {
        position: { lat: number; lng: number };
        map: Map | null;
        title?: string;
      });
    }

    namespace places {
      class AutocompleteSessionToken {}

      class PlacesService {
        constructor(map: Map);
        textSearch(
          request: GooglePlacesTextSearchRequest,
          callback: (results: GooglePlacesResult[], status: string) => void
        ): void;
      }

      const PlacesServiceStatus: {
        OK: string;
      };
    }
  }
}

interface Window {
  google: {
    maps: {
      Map: typeof google.maps.Map;
      Marker: typeof google.maps.Marker;
      importLibrary: (name: string) => Promise<Record<string, unknown>>;
      places: {
        AutocompleteSessionToken: typeof google.maps.places.AutocompleteSessionToken;
        PlacesService: typeof google.maps.places.PlacesService;
        PlacesServiceStatus: typeof google.maps.places.PlacesServiceStatus;
      };
    };
  };
}
