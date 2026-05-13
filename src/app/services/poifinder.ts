import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

export interface Poi {
  id?: number;
  name: string;
  type: string;
  lat: number;
  lon: number;
  distance?: number;
  address?: any;
  extratags?: {
    phone?: string;
    website?: string;
    hours?: string;
  }
}

export interface ViewBox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

@Injectable({
  providedIn: 'root',
})

export class POIFinderService {

  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org/search';
  private readonly overpassUrl = 'https://overpass.openstreetmap.fr/api/interpreter';
  private readonly userAgent = 'MacdoAngularApp/1.0 (emmaviel88@gmail.com)';

  constructor(private http: HttpClient) {}

  // Requête valide pour Nominatim : 
  // https://nominatim.openstreetmap.org/search?format=json&q=McDonald's&viewbox=2.3422,48.8466,2.3622,48.8666&bounded=1&limit=20
  // https://nominatim.openstreetmap.org/search?format=json&q=McDonald%27s&viewbox=2.3422,48.8466,2.3622,48.8666&bounded=1&limit=2&addressdetails=1&extratags=1
  // https://nominatim.openstreetmap.org/search?format=json&q=McDonald%27s+Paris+France&limit=10
  
  // https://nominatim.openstreetmap.org/search?amenity=McDonald%27s&city=Epinal&country=Fr&format=jsonv2

  // Requête 'reverse' valide pour Nominatim :
  // https://nominatim.openstreetmap.org/reverse?lat=48.9010502&lon=6.0641486&format=json

  // Adresse interface Nominatim :
  // https://nominatim.openstreetmap.org/ui/search.html

  searchPOIsbyNominatim(placeLat: number, placeLon: number, place: string, limit: number = 5): Observable<Poi[]> {
    
    // Si un lieu est fourni dans place, on l'utilise pour construire la requête de recherche, sinon on utilise une requête par défaut centrée sur Paris
    const searchQuery = place ? `McDonald's+${place}+Fr` : "McDonald's+Paris+France"; // Par défaut, recherche de McDonald's à Paris

    console.log('Recherche de POIs avec Nominatim pour : ', searchQuery);

    let params = new HttpParams()
    .set('q', searchQuery)
    .set('limit', limit.toString())
    .set('addressdetails', '1')
    .set('extratags', '1')
    .set('format', 'jsonv2');

    console.log('poifinder-66: Recherche Nominatim avec params : ', params.toString());

    const headers = new HttpHeaders({
      'User-Agent': this.userAgent
    });
    console.log('Headers pour Nominatim : ', headers);

    return this.http.get<any[]>(this.nominatimUrl, { headers, params }).pipe(
      catchError((error) => {
        console.error('Erreur Nominatim :', error);
        return of([]);
      }),
      map((results: any[]) => {
        return results
          //.filter((item) => item.extratags && item.extratags.amenity) // Filtrer les résultats pour ne garder que ceux avec une étiquette d'amenity
          .map((item, index) => ({
            id: index + 1,
            name: item.name || item.display_name.split(',')[0],
            type: item.type || 'unknown',
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            distance: (this.calculateDistance(placeLat, placeLon, item.lat, item.lon)), 
            address: `${item.address.road || ''}, ${item.address.postcode || ''} - ${item.address.village || item.address.city || item.address.town}`,
            extratags: {
              phone: (item.extratags?.phone ?? item.extratags?.['contact:phone']) || '',
              website: (item.extratags?.website ?? item.extratags?.['contact:website']) || '',
              hours: item.extratags.opening_hours?.toString()
                        .replace(/\bMo\b/g, "Lun")
                        .replace(/\bTu\b/g, "Mar")
                        .replace(/\bWe\b/g, "Mer")
                        .replace(/\bTh\b/g, "Jeu")
                        .replace(/\bFr\b/g, "Ven")
                        .replace(/\bSa\b/g, "Sam")
                        .replace(/\bSu\b/g, "Dim") || 'Pas d\'information'
            }
          }));
      }),
    );
  }

  // Recherche de POI autour d'une position [lat, lon] avec Nominatim
  searchPoisByOverpass(lat: number, lon: number, radius: number = 1000, amenity?: string): Observable<Poi[]> {
    console.log('64: entrée dans searchPoisByOverpass avec : ', lat, lon, radius, amenity);

    let km = 0.0;

    const query = `
      [out:json][timeout:25];
      (
        node["amenity"="restaurant"]["name"~"herbes", i](around:${radius},${lat},${lon});
      );
      out center;
      `;
      
    // node["amenity"="fast_food"]["name"~"McDonald's",i](around:${radius},${lat},${lon});
    // way["amenity"="fast_food"]["name"~"McDonald",i](around:${radius},${latitude},${longitude});
    // relation["amenity"="fast_food"]["name"~"McDonald",i](around:${radius},${latitude},${longitude});
    // node["amenity"=${ amenity }](around:${ radius },${ lat },${ lon });

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
          distance: this.calculateDistance(lat, lon, element.lat || element.center.lat, element.lon || element.center.lon) // Convertir en km
        }));
      })
    );
  }

  // Calcule la distance entre 2 points géographiques en mètres
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Rayon de la Terre en km
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

  private calculateViewbox(lat: number, lon: number, radiusM: number): ViewBox {
  // Conversion du rayon en degrés pour la latitude (1 km ≈ 0.009°)
  const deltaLat = (radiusM/1000) * 0.009;

  // Conversion du rayon en degrés pour la longitude (dépend de la latitude)
  const deltaLon = (radiusM/1000) * 0.009 / Math.cos(lat * (Math.PI / 180));

  // Calcul des limites
  const minLat = lat - deltaLat;
  const maxLat = lat + deltaLat;
  const minLon = lon - deltaLon;
  const maxLon = lon + deltaLon;
  
  console.log(`Viewbox calculée : minLat=${minLat}, minLon=${minLon}, maxLat=${maxLat}, maxLon=${maxLon}`);

  // Retourne la viewbox au format "min_lon,min_lat,max_lon,max_lat"
  return { minLon, minLat, maxLon, maxLat };
}

}

