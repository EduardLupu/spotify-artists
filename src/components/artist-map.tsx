"use client";

import React, { useEffect, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { Tooltip } from "react-tooltip";

const geoUrl =
  "https://cdn.jsdelivr.net/gh/gavinr/world-countries-centroids@v1/dist/world-countries.json";

interface City {
  cid: number;
  name: string;
  cc: string;
  lat: number;
  lon: number;
  listeners: number;
}

interface Artist {
  i: string;
  n: string;
  p: string;
  topCities: {
    fields: string[];
    rows: (string | number)[][];
  };
}

const ArtistMap = ({ artistId }: { artistId: string }) => {
  const [cities, setCities] = useState<City[]>([]);
  const [artist, setArtist] = useState<Artist | null>(null);

  useEffect(() => {
    fetch("/data/latest/geo-cities.json")
      .then((res) => res.json())
      .then((data) => {
        const cityData = data.rows.map((row: any[]) => ({
          cid: row[0],
          name: row[1],
          cc: row[2],
          lat: row[3],
          lon: row[4],
        }));
        setCities(cityData);
      });
  }, []);

  useEffect(() => {
    if (artistId) {
      fetch(`/data/artists/${artistId.substring(0, 2)}/${artistId}.json`)
        .then((res) => res.json())
        .then((data) => {
          setArtist(data);
        });
    }
  }, [artistId]);

  const artistCities = artist?.topCities?.rows.map((row) => ({
    cid: row[0] as number,
    listeners: row[1] as number,
  })) || [];

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  return (
    <>
      <ComposableMap
        projectionConfig={{
          scale: 205,
        }}
        width={800}
        height={400}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup center={[0, 20]} zoom={1}>
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#1a1a1a"
                  stroke="#404040"
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>
          {cities
            .filter((city) => artistCities.some(ac => ac.cid === city.cid))
            .map(({ name, lon, lat, cid }) => {
              const artistCity = artistCities.find(ac => ac.cid === cid);
              return (
                <Marker key={name} coordinates={[lon, lat]}>
                  <circle
                    r={Math.max(2, Math.log((artistCity?.listeners || 0) / 5000) * 2)}
                    fill="rgba(30, 215, 96, 0.5)"
                    stroke="#1ed760"
                    strokeWidth={1}
                    data-tooltip-id="my-tooltip"
                    data-tooltip-content={`${name}: ${formatNumber(artistCity?.listeners || 0)} listeners`}
                  />
                </Marker>
              );
            })}
        </ZoomableGroup>
      </ComposableMap>
      <Tooltip id="my-tooltip" />
    </>
  );
};

export default ArtistMap;
