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
  public lat: number = 48.1747684; // Épinal par défaut
  public lon: number = 6.4503643;
  public limit: number = 5;
  public radius: number = 1000;
  public amenity: string = 'restaurant';
  public position!: Poi; //| null = null;
  pois: Poi[] = [];
  isLoading: boolean = false;
  error: string | null = null;
  markers: L.Marker[] = [];
  public mcdoIcon!: L.Icon;
  
  constructor(private http: HttpClient, private poiFinder: POIFinderService, private cdr: ChangeDetectorRef) {}

  // Créer une icône personnalisée pour McDonald's

  ngOnInit(): void {

  }
  

  ngAfterViewInit(): void {
    this.initMap();
  }

  private initMap(): void {
    // Coordonnées de Paris par défaut
    const initialMapCenter = { lat: 48.8566, lng: 2.3522 }; // Paris
    // const initialMapCenter = {lat: 48.1295499, lng: 6.6753083}; // Tendon

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

    this.mcdoIcon = L.icon({
      iconUrl: 'mcdonalds.ico',
      iconSize: [40, 30], // Taille de l'icône
      iconAnchor: [20, 30], // Point d'ancrage (centre en bas)
      popupAnchor: [0, -30] // Position de la popup
    });

    console.log('72: mcdoIcon:', this.mcdoIcon);

    // Ajout d'un marqueur pour indiquer la position actuelle
    // L.marker(initialMapCenter).addTo(this.map)
    //   .bindPopup('Vous êtes ici !')
    //   .openPopup();
  }  

  search(): void {
    if(!this.searchQuery.trim()) {
      console.error('La requête de recherche est vide.');
      alert('La requête de recherche est vide !');
      return;
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.searchQuery)}`;
    // console.log("Recherche de : ", this.searchQuery, encodeURIComponent(this.searchQuery));

    this.http.get<any []>(url).subscribe({
      next: (results) => {
        if(results && results.length >0) {
          const lat = parseFloat(results[0].lat);
          const lon = parseFloat(results[0].lon);
          this.map.setView([lat, lon], 10);

          this.position = {
            name: results[0].display_name,
            type: 'location',
            lat: lat,
            lon: lon
          };

          this.lat = parseFloat(results[0].lat);
          this.lon = parseFloat(results[0].lon);

          console.log(`102: lieu: ${results[0].display_name}, Lat: ${results[0].lat} - Lon: ${results[0].lon}`);
          console.log('103: Position trouvée : ', this.position);
          // L.marker([lat, lon], { title: this.searchQuery.charAt(0).toUpperCase() + this.searchQuery.slice(1) }).addTo(this.map);
          //   .bindPopup(`${this.searchQuery.toLocaleUpperCase()}. <br>Lat: ${lat}, <br>Lon: ${lon}`)
          //   .openPopup();

          // Appel la fonction de recherche de POIS à proximité de la position saisie
          this.searchPOIs();
        } else {
          alert('Ville non trouvée.');
        }
      },
      error: (err) => {
        console.error("Erreur lors de la recherche : ", err);
        alert("Erreur lors de la recherche");
      }
    });
    // Attendre la fin de la fonction

  }

  // searchPOIs(): void {
  //   this.isLoading = true;
  //   this.error = null;
  //   this.search();

  //   // Utilisation d'Overpass pour rechercher les POIs autour de la position
  //   this.poiFinder.searchPoisByOverpass(this.lat, this.lon, this.radius, this.amenity).subscribe({
  //     next: (pois) => {
  //       console.log('POIs retournés : ', pois);
  //       this.pois = pois;
  //       console.log(`isLoading avant mise à jour : ${this.isLoading}`);
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

  searchPOIs(): void {
    let horaires : string = '';
    this.isLoading = true;
    this.error = null;

    this.clearMarkers(); // Supprimer les anciens markers avant d'ajouter les nouveaux

    // Utilisation de Nominatim pour rechercher les POIs autour de la position
    this.poiFinder.searchPOIsbyNominatim(this.position.lat, this.position.lon, this.searchQuery, this.limit).subscribe({
      next: (pois) => {
        // console.log('108: POIs retournés : ', pois);
        this.pois = pois;
        if (pois.length > 0) {
          this.clearMarkers(); // Supprimer les anciens markers avant d'ajouter les nouveaux
          pois.forEach(element => {
            // this.http.get<any>(`https://nominatim.openstreetmap.org/reverse?lat=${element.lat}&lon=${element.lon}&format=json`).subscribe({
            //   next: (result) => {
            //     console.log('map.ts-168: Résultat de la requête Nominatim Reverse : ', result);
            //     element.address = `${result.address.road || ''}, ${result.address.postcode || ''} - ${result.address.village || result.address.city || result}`;
            //   },
            //   error: (err) => {
            //     console.error('Erreur lors de la requête Nominatim Reverse : ', err);
            //     element.address = 'Adresse non disponible';
            //   }
            // });
            this.addMarker(element.lat, element.lon, this.mcdoIcon, element.extratags, element.id || 0 ); // Ajouter un marker pour chaque POI trouvé
          });
          // // Centrer la carte sur le premier POI trouvé
          // const firstPoi = pois[0];
          // this.map.setView([firstPoi.lat, firstPoi.lon], 13);
        }
        // console.log(`110: isLoading avant mise à jour : ${this.isLoading}`);
        this.isLoading = false;
        // console.log(`isLoading après mise à jour : ${this.isLoading}`);
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

  addMarker(lat: number, lng: number, mkr: L.Icon, extratags: any, id: number): void {
    console.log('extratags: ', extratags);

    // Ajouter un nouveau marker
    // const newMarker = L.marker([lat, lng], { icon: mkr, title: `N° ${id}` })
    const newMarker = L.marker([lat, lng], { icon: mkr })
      .addTo(this.map)
      .addTo(this.map)
      .bindPopup(`${id}. ${this.pois[id-1]?.name || 'POI'} 
                        - ${this.pois[id-1]?.address || 'Adresse non disponible'}<br>
                        ${extratags.website ? `<a href="${extratags.website}" target="_blank">Site web</a><br>` : '<span>Site web non disponible</span><br>'}
                         Tél: ${extratags.phone}<br>
                         Horaires: ${extratags.hours}<br>
                         <small>Coordonnées: Lat: ${lat}, Lon: ${lng}</small>`)
      .bindTooltip(`N° ${id}`, 
        { permanent: false, // s'affiche quand le pointeur de la souris est au-dessus du marker
          direction: 'auto', // positionnement automatique du tooltip
          className: 'mcdo-tooltip' });
    this.markers.push(newMarker); // Stocker le marker dans le tableau
  }

  clearMarkers(): void {
    // Parcourir tous les markers et les supprimer de la carte
    this.markers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.markers = []; // Vider le tableau
  }
} 
