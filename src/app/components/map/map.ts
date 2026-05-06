import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import * as L from 'leaflet';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Poi, POIFinderService } from '../../services/poifinder';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map.html',
  styleUrl: './map.css',
})

export class Map implements OnInit, AfterViewInit {
  private map!: L.Map;
  searchQuery: string = '';
  lat: number = 48.1747684; // Épinal par défaut
  lon: number = 6.4503643;
  radius: number = 1000;
  amenity: string = 'restaurant';
  position: Poi | null = null;
  pois: Poi[] = [];
  isLoading: boolean = false;
  error: string | null = null;

  constructor(private http: HttpClient, private poiFinder: POIFinderService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initMap();
  }

  private initMap(): void {
    // Coordonnées de Paris par défaut
    // const initialMapCenter = { lat: 48.8566, lng: 2.3522 }; // Paris
    const initialMapCenter = {lat: 48.1295499, lng: 6.6753083}; // Tendon

    // Initialisation de la carte
    this.map = L.map('map').setView(initialMapCenter, 13);

    // Ajout de la couche OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Fix pour les icônes Leaflet manquantes
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });

    // Ajout d'un marqueur pour indiquer la position actuelle
    L.marker(initialMapCenter).addTo(this.map)
      .bindPopup('Vous êtes ici !')
      .openPopup();
  }  

  search(): void {
    if(!this.searchQuery.trim()) {
      console.error('La requête de recherche est vide.');
      return;
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.searchQuery)}`;
    // console.log("Recherche de : ", this.searchQuery, encodeURIComponent(this.searchQuery));

    this.http.get<any []>(url).subscribe({
      next: (results) => {
        if(results && results.length >0) {
          const lat = parseFloat(results[0].lat);
          const lon = parseFloat(results[0].lon);
          this.map.setView([lat, lon], 13);

          this.position = {
            name: results[0].display_name,
            type: 'location',
            lat,
            lon
          };
          console.log('Position trouvée : ', this.position);
          // L.marker([lat, lon]).addTo(this.map)
          //   .bindPopup(`${this.searchQuery.toLocaleUpperCase()}. <br>Lat: ${lat}, <br>Lon: ${lon}`)
          //   .openPopup();
        } else {
          alert('Ville non trouvée.');
        }
      },
      error: (err) => {
        console.error("Erreur lors de la recherche : ", err);
        alert("Erreur lors de la recherche");
      }
    });
  }

  searchPOIs(): void {
    this.isLoading = true;
    this.error = null;
    this.search();

    // Utilisation d'Overpass pour rechercher les POIs autour de la position
    this.poiFinder.searchPoisByOverpass(this.lat, this.lon, this.radius, this.amenity).subscribe({
      next: (pois) => {
        console.log('POIs retournés : ', pois);
        this.pois = pois;
        console.log(`isLoading avant mise à jour : ${this.isLoading}`);
        this.isLoading = false;
        console.log(`isLoading après mise à jour : ${this.isLoading}`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Erreur lors de la recherche des POIs';
        console.error(err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // searchPOIs(): void {
  // this.isLoading = true;
  // this.error = null;

    // Utilisation d'Overpass pour rechercher les POIs autour de la position
  //   this.poiFinder.searchPOIsbyNominatim(this.lat, this.lon, this.radius, 'restaurant').subscribe({
  //     next: (pois) => {
  //       console.log('108: POIs retournés : ', pois);
  //       this.pois = pois;
  //       console.log(`110: isLoading avant mise à jour : ${this.isLoading}`);
  //       this.isLoading = false;
  //       console.log(`isLoading après mise à jour : ${this.isLoading}`);
  //       this.cdr.detectChanges();
  //     },
  //     error: (err) => {
  //       this.error = 'Erreur lors de la recherche des POIs';
  //       console.error(err);
  //       this.isLoading = false;
  //       this.cdr.detectChanges();
  //     }
  //   });
  // }
} 
