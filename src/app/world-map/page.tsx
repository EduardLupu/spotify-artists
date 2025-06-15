'use client';

import { TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useState, useEffect, useRef } from 'react';
import { useMapData } from '@/contexts/MapDataContext';
import { useMap } from 'react-leaflet';
import { getCountryByAlpha2 } from 'country-locale-map';
import dynamic from 'next/dynamic'; // Import dynamic

const initializeLeaflet = () => {
  if (typeof window !== 'undefined') {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });
  }
};

type ArtistDetail = { artist: string; listeners: number; image?: string };

type CityMarkerData = { city: string; country: string; lat: number; lng: number; artists: ArtistDetail[] };

// Component to handle map interactions
function MapInteractions({ selectedCity, selectedCountry, countryCentroids }: { selectedCity: CityMarkerData | null; selectedCountry: string | null; countryCentroids: Map<string, [number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (selectedCity) {
      map.setView([selectedCity.lat, selectedCity.lng], 4); // Zoom to city
    } else if (selectedCountry) {
      const centroid = countryCentroids.get(selectedCountry.toLowerCase());
      if (centroid) {
        map.setView([centroid[1], centroid[0]], 2); // Zoom to country, Leaflet expects [lat, lng]
      }
    }
  }, [map, selectedCity, selectedCountry, countryCentroids]);

  return null;
}

// New component to encapsulate MapContainer content
function LeafletMapContent({
  loadingMapData,
  countriesGeoJSON,
  selectedCountry,
  handleCountryClick,
  cityMarkers,
  handleMarkerClick,
  selectedCity,
  countryCentroids,
  markerRefs,
}: {
  loadingMapData: boolean;
  countriesGeoJSON: any;
  selectedCountry: string | null;
  handleCountryClick: (countryName: string) => void;
  cityMarkers: CityMarkerData[];
  handleMarkerClick: (marker: CityMarkerData) => void;
  selectedCity: CityMarkerData | null;
  countryCentroids: Map<string, [number, number]>;
  markerRefs: React.RefObject<Map<string, L.Marker>>;
}) {
  const map = useMap(); // Get map instance
  const [scaledMarkerIcon, setScaledMarkerIcon] = useState(L.divIcon({
    className: 'custom-div-icon',
    html: '<div style="background-color:#F53; width: 4px; height: 4px; border-radius: 50%; border: 0.2px solid #000;"></div>',
    iconSize: [8, 8],
    iconAnchor: [2, 2],
    popupAnchor: [0, -2],
  }));

  useEffect(() => {
    const updateMarkerSize = () => {
      const currentZoom = map.getZoom();
      let newSize = 4;
      let newBorder = 0.2;
      let newBackgroundColor = '#F53';
      let newBorderColor = '#000';

      if (currentZoom <= 2) {
        newSize = 8;
        newBorder = 0.25;
        newBackgroundColor = '#F53';
        newBorderColor = '#000';
      } else if (currentZoom > 2 && currentZoom <= 4) {
        newSize = 12;
        newBorder = 0.35;
        newBackgroundColor = '#F53';
        newBorderColor = '#000';
      } else if (currentZoom > 4 && currentZoom <= 6) {
        newSize = 16;
        newBorder = 0.55;
        newBackgroundColor = '#F53';
        newBorderColor = '#000';
      }
      else if (currentZoom > 6 && currentZoom <= 8) {
          newSize = 20;
          newBorder = 0.75;
          newBackgroundColor = '#F53';
          newBorderColor = '#000';
      }

      const newIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color:${newBackgroundColor}; width: ${newSize}px; height: ${newSize}px; border-radius: 50%; border: ${newBorder}px solid ${newBorderColor};"></div>`,
        iconSize: [newSize, newSize],
        iconAnchor: [newSize / 2, newSize / 2],
        popupAnchor: [0, -newSize / 2],
      });
      setScaledMarkerIcon(newIcon);
      if (markerRefs.current) {
        markerRefs.current.forEach((marker) => {
          marker.setIcon(newIcon);
        });
      }
    };

    map.on('zoomend', updateMarkerSize);
    // Initial size setting
    updateMarkerSize();

    return () => {
      map.off('zoomend', updateMarkerSize);
    };
  }, [map, markerRefs]);

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {countriesGeoJSON && (
        <GeoJSON
          data={countriesGeoJSON}
          style={() => ({ // Default style for countries
            weight: 0,
            opacity: 0,
            fillOpacity: 0,
            cursor: 'pointer',
          })}
          onEachFeature={(feature, layer) => {
            const countryName = feature.properties.name || feature.properties.NAME;
            const pathLayer = layer as L.Path;
            pathLayer.on({
              click: () => handleCountryClick(countryName),
              mouseover: (e) => {
                pathLayer.setStyle({ 
                  fillColor: '#e6e6e6',
                  fillOpacity: 0.3,
                  weight: 1.5
                });
              },
              mouseout: () => {
                pathLayer.setStyle({ 
                  fillColor: '#ffffff',
                  fillOpacity: 0.1,
                  weight: 1
                });
              },
            });
            if (selectedCountry && selectedCountry.toLowerCase() === countryName.toLowerCase()) {
              pathLayer.setStyle({ 
                fillColor: '#60A5FA',
                fillOpacity: 0.3,
                weight: 1.5
              });
            }
          }}
        />
      )}
      {!loadingMapData && cityMarkers.map((marker, idx) => (
        <Marker
          key={marker.city + marker.country + idx}
          position={[marker.lat, marker.lng]}
          icon={scaledMarkerIcon}
          ref={(markerInstance: L.Marker | null) => {
            if (markerInstance) {
              markerRefs.current?.set(`${marker.city}-${marker.country}`, markerInstance);
            } else {
              markerRefs.current?.delete(`${marker.city}-${marker.country}`);
            }
          }}
          eventHandlers={{
            click: () => handleMarkerClick(marker),
          }}
        >
          <Popup>
            <b>{marker.city}, {marker.country}</b><br/>
            Artists: {marker.artists.length}
          </Popup>
        </Marker>
      ))}
      <MapInteractions selectedCity={selectedCity} selectedCountry={selectedCountry} countryCentroids={countryCentroids} />
    </>
  );
}

// Dynamically import MapContainer to ensure client-side rendering
const DynamicMapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  {
    ssr: false, // This is crucial for client-side only rendering
  }
);

export default function WorldMap2() {
  const { mapData, loadingMapData } = useMapData();
  const [cityMarkers, setCityMarkers] = useState<CityMarkerData[]>([]);
  const [artistsByCountry, setArtistsByCountry] = useState<Map<string, ArtistDetail[]>>(new Map());
  const [selectedCity, setSelectedCity] = useState<CityMarkerData | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countriesGeoJSON, setCountriesGeoJSON] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchType, setSearchType] = useState<'city' | 'country'>('city');
  const [suggestions, setSuggestions] = useState<Array<{ type: 'city' | 'country'; name: string; lat?: number; lng?: number; }>>([]);
  const [countryCentroids, setCountryCentroids] = useState<Map<string, [number, number]>>(new Map());
  const [topojsonFeature, setTopojsonFeature] = useState<any>(null);
  const markerRefs = useRef<Map<string, L.Marker>>(new Map<string, L.Marker>());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    initializeLeaflet();
  }, []);

  useEffect(() => {
    if (mapData) {
      setCityMarkers(mapData.cityMarkers);
      setArtistsByCountry(new Map(Object.entries(mapData.artistsByCountry)));
    }

    import('topojson-client')
      .then(module => {
        setTopojsonFeature(() => module.feature);
      })
      .catch(error => console.error("Error dynamically importing topojson-client:", error));

  }, [mapData]);

  useEffect(() => {
    if (topojsonFeature) {
      fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
        .then(response => response.json())
        .then(data => {
          const countries = topojsonFeature(data, data.objects.countries);
          // Filter out Russia from the features
          const filteredCountries = {
            ...countries,
            features: countries.features.filter((feature: any) => 
              feature.properties.name !== 'Russia' && 
              feature.properties.NAME !== 'Russia'
            )
          };
          setCountriesGeoJSON(filteredCountries);
        })
        .catch(error => console.error("Error fetching countries GeoJSON:", error));
    }
  }, [topojsonFeature]);

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/gh/gavinr/world-countries-centroids@v1/dist/countries.geojson')
      .then(response => response.json())
      .then(data => {
        const centroidsMap = new Map<string, [number, number]>();
        data.features.forEach((feature: any) => {
          const countryName = feature.properties.COUNTRY;
          const coordinates = feature.geometry.coordinates;
          if (countryName && coordinates) {
            centroidsMap.set(countryName.toLowerCase(), coordinates);
          }
        });
        setCountryCentroids(centroidsMap);
      })
      .catch(error => console.error('Error fetching country centroids:', error));
  }, []);

  const handleMarkerClick = (marker: CityMarkerData) => {
    setSelectedCity(marker);
    setSelectedCountry(null);
  };

  const handleCountryClick = (countryName: string) => {
    setSelectedCountry(countryName);
    setSelectedCity(null);
  };

  const handleSearch = (selectedSuggestion: { type: 'city' | 'country'; name: string; lat?: number; lng?: number; }) => {
    setSearchTerm(selectedSuggestion.name);
    setSuggestions([]);

    if (selectedSuggestion.type === 'city' && selectedSuggestion.lat && selectedSuggestion.lng) {
      const matchedCity = cityMarkers.find(marker => 
        `${marker.city}, ${marker.country}`.toLowerCase() === selectedSuggestion.name.toLowerCase()
      );
      if (matchedCity) {
        setSelectedCity(matchedCity);
        setSelectedCountry(null);
        // Get the marker reference and open its popup
        const markerRef = markerRefs.current?.get(`${matchedCity.city}-${matchedCity.country}`);
        if (markerRef) {
          markerRef.openPopup();
        }
      }
    } else if (selectedSuggestion.type === 'country') {
      setSelectedCountry(selectedSuggestion.name);
      setSelectedCity(null);
      const countryCentroid = countryCentroids.get(selectedSuggestion.name.toLowerCase());
      if (countryCentroid) {
      }
    }
  };

  useEffect(() => {
    if (searchTerm.length > 0) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      let newSuggestions: Array<{ type: 'city' | 'country'; name: string; lat?: number; lng?: number; }> = [];

      if (searchType === 'city') {
        newSuggestions = cityMarkers
          .filter(marker => 
            marker.city.toLowerCase().includes(lowerCaseSearchTerm) ||
            marker.country.toLowerCase().includes(lowerCaseSearchTerm)
          )
          .map(marker => ({ type: 'city', name: `${marker.city}, ${marker.country}`, lat: marker.lat, lng: marker.lng }));
      } else if (searchType === 'country') {
        newSuggestions = Array.from(artistsByCountry.keys())
          .filter(countryName => countryName.toLowerCase().includes(lowerCaseSearchTerm))
          .map(countryName => ({ 
            type: 'country', 
            name: countryName.charAt(0).toUpperCase() + countryName.slice(1)
          }));
      }
      setSuggestions(newSuggestions.slice(0, 10));
    } else {
      setSuggestions([]);
    }
  }, [searchTerm, searchType, cityMarkers, artistsByCountry]);

  if (!isClient) {
    return (
      <div className="min-h-screen w-screen bg-[#e5eaec] flex items-center justify-center">
        <p className="text-xl text-gray-700">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-[#e5eaec] flex flex-row items-start justify-start overflow-x-hidden" style={{ padding: 0, margin: 0 }}>
      <button
        onClick={() => setIsSearchOpen(!isSearchOpen)}
        className={`fixed top-0 p-3 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-all duration-300 ease-in-out ${isSearchOpen ? 'left-[404px] opacity-0' : 'left-4'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
      
      {/* Left Sidebar - Search Section */}
      <div className={`h-screen bg-white border-r border-gray-300 shadow-lg transition-all duration-300 ease-in-out z-50 ${isSearchOpen ? 'w-[400px]' : 'w-0'} ${isSearchOpen ? '' : 'overflow-hidden'}`}>
        <div className={`p-6 h-full ${isSearchOpen ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 ease-in-out ${isSearchOpen ? 'pointer-events-auto' : 'pointer-events-none'} overflow-y-auto`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Search</h2>
            <button
              onClick={() => setIsSearchOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex justify-center mb-6">
            <button
              className={`px-6 py-3 rounded-l-md text-lg font-medium transition-colors duration-200 ${searchType === 'city' ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              onClick={() => setSearchType('city')}
            >
              Search by City
            </button>
            <button
              className={`px-6 py-3 rounded-r-md text-lg font-medium transition-colors duration-200 ${searchType === 'country' ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              onClick={() => setSearchType('country')}
            >
              Search by Country
            </button>
          </div>
          <div className="relative w-full">
            <input
              type="text"
              placeholder={`Search for a ${searchType}...`}
              className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg text-gray-900 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {suggestions.length > 0 && searchTerm.length > 0 && (
              <ul className="absolute bg-white border border-gray-200 rounded-lg mt-2 w-full max-h-60 overflow-y-auto shadow-xl z-10">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    className="p-4 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-lg text-gray-800 transition-colors duration-150"
                    onClick={() => handleSearch(suggestion)}
                  >
                    {suggestion.type === 'country' ? suggestion.name.charAt(0).toUpperCase() + suggestion.name.slice(1) : suggestion.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      {/* Map and Right Sidebar Container */}
      <div className="flex-1 flex flex-row h-screen">
        <div className="flex-1 h-screen relative flex flex-col">
          {loadingMapData && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-20">
              <p className="text-xl text-gray-700">Loading map data...</p>
            </div>
          )}
          <DynamicMapContainer 
            key="world-map-2-container" 
            center={[0, 0] as [number, number]} 
            zoom={2}
            minZoom={2}
            maxZoom={8} 
            style={{ height: '100%', width: '100%' }} 
            attributionControl={false}
            maxBounds={[[-90, -180], [90, 180]]}
            maxBoundsViscosity={1.0}
          >
            <LeafletMapContent 
              loadingMapData={loadingMapData}
              countriesGeoJSON={countriesGeoJSON}
              selectedCountry={selectedCountry}
              handleCountryClick={handleCountryClick}
              cityMarkers={cityMarkers}
              handleMarkerClick={handleMarkerClick}
              selectedCity={selectedCity}
              countryCentroids={countryCentroids}
              markerRefs={markerRefs}
            />
          </DynamicMapContainer>
        </div>
        {(selectedCity || selectedCountry) && (
          <div className="w-[400px] h-screen bg-white border-l border-gray-300 shadow-lg overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {selectedCity ? `Top Artists in ${selectedCity.city}, ${getCountryByAlpha2(selectedCity.country)?.name}` : `Top Artists in ${selectedCountry}`}
              </h2>
              <button className="text-gray-500 hover:text-black text-2xl" onClick={() => { setSelectedCity(null); setSelectedCountry(null); }}>&times;</button>
            </div>
            {(selectedCity?.artists || artistsByCountry.get(selectedCountry?.toLowerCase() || ''))?.length === 0 ? (
              <div className="text-gray-500">No artists found for this {selectedCity ? 'city' : 'country'}.</div>
            ) : (
              <ul>
                {(selectedCity?.artists || artistsByCountry.get(selectedCountry?.toLowerCase() || ''))?.map((artist, idx) => (
                  <li key={artist.artist + idx} className="flex items-center mb-4">
                    {artist.image ? (
                      <img src={`https://i.scdn.co/image/${artist.image}`} alt={artist.artist} className="w-10 h-10 rounded mr-3" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-200 mr-3" />
                    )}
                    <div>
                      <div className="font-semibold text-gray-800">{artist.artist}</div>
                      <div className="text-xs text-gray-800">{artist.listeners.toLocaleString()} listeners</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 