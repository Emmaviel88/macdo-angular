import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

export interface Poi {
  name: string;
  type: string;
  lat: number;
  lon: number;
  distance?: number;
  address?: any;
}

@Injectable({
  providedIn: 'root',
})

export class POIFinderService {

  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org/search';
  private readonly overpassUrl = 'https://overpass.openstreetmap.fr/api/interpreter';
  // 'https://overpass-api.de/api/interpreter';
  private readonly userAgent = 'MacdoAngularApp/1.0 (emmaviel88@gmail.com)';

  constructor(private http: HttpClient) {}

  // Recherche de POI autour d'une position [lat, lon] avec Nominatim
  searchPOIsbyNominatim(lat: number, lon: number, radius: number = 1000, amenity?: string): Observable<Poi[]> {
    let params = new HttpParams()
      .set('format', 'json')
      .set('lat', lat.toString())
      .set('lon', lon.toString())
      .set('zoom', '18')
      .set('addressdetails', '1')
      .set('extratags', '1')
      .set('limit', '5');

    if (amenity) {
      params = params.set('amenity', amenity);
    }

    return this.http.get<any[]>(this.nominatimUrl, { params }).pipe(
      catchError((error) => {
        console.error('Erreur Nominatim :', error);
        return of([]);
      }),
      map((results: any[]) => {
        return results
          .filter((item) => item.extratags && item.extratags.amenity) // Filtrer les résultats pour ne garder que ceux avec une étiquette d'amenity
          .map((item) => ({
            name: item.name || item.display_name.split(',')[0],
            type: item.extratags.amenity,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            distance: item.distance ? parseFloat(item.distance) : undefined,
            address: item.address
          }));
      }),
    );
  }

  // Recherche de POI autour d'une position [lat, lon] avec Nominatim
  searchPoisByOverpass(lat: number, lon: number, radius: number = 1000, amenity?: string): Observable<Poi[]> {
    console.log('64: entrée dans searchPoisByOverpass avec : ', lat, lon, radius, amenity);

      // [out:json];
      // (
      //   node["${amenity ? `amenity=${amenity}` : 'amenity'}"](around:${radius},${lat},${lon});
      //   way["${amenity ? `amenity=${amenity}` : 'amenity'}"](around:${radius},${lat},${lon});
      //   relation["${amenity ? `amenity=${amenity}` : 'amenity'}"](around:${radius},${lat},${lon});
      // );
      // out center;
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"=${ amenity }](around:${ radius },${ lat },${ lon });
      );
      out center;
      `;
      
      // way["amenity"="fast-food"](around:${radius},${lat},${lon});
    console.log('81: Requête Overpass : ', query);

    const params = new HttpParams().set('data', query);
    console.log('Params pour Overpass : ', params.toString());

    return this.http.get<any>(this.overpassUrl, { params }).pipe(
      catchError(error => {
        console.error('Erreur Overpass:', error);
        return of({ elements: [] });
      }),
      map((response: any) => {
        return response.elements.map((element: any) => ({
          name: element.tags?.name || 'Non nommé',
          type: element.tags?.amenity || 'unknown',
          lat: element.lat || element.center.lat,
          lon: element.lon || element.center.lon,
          distance: this.calculateDistance(lat, lon, element.lat || element.center.lat, element.lon || element.center.lon)
        }));
      })
    );
  }

  // Calcule la distance entre 2 points géographiques en mètres
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

