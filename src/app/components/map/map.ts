import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import * as L from 'leaflet';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Poi, POIFinderService } from '../../services/poifinder';
import { debounceTime, distinctUntilChanged, switchMap} from 'rxjs/operators';

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
    this.map = L.map('map').setView(initialMapCenter, 6);

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

    // Création icone personnalisée pour McDonald's
    this.mcdoIcon = L.icon({
      iconUrl: 'mcdonalds.ico',
      iconSize: [40, 30], // Taille de l'icône
      iconAnchor: [20, 30], // Point d'ancrage (centre en bas)
      popupAnchor: [0, -30] // Position de la popup
    });
  }  

  search(): void {
    if(!this.searchQuery.trim()) {
      console.error('La requête de recherche est vide.');
      alert('La requête de recherche est vide !');
      return;
    }

    // Mettre la première lettre en majuscule pour une meilleure présentation
    this.searchQuery = this.searchQuery.charAt(0).toUpperCase() + this.searchQuery.slice(1);

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.searchQuery)}`;

    // Utilisation de Nominatim pour rechercher les coordonnées de la ville saisie
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

          // Appel la fonction de recherche de POIS (McDOnald's) à proximité de la position saisie
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
  }

  inputChange(): void {
    // Réinitialiser les résultats de la recherche précédente
    console.log(`searchQuery mis à jour : ${this.searchQuery}` );
    
  }

  // Recherche des POIs (McDonald's) avec leurs détails (adresses, horaires, site web, ...) à proximité de la position saisie
  searchPOIs(): void {
    let horaires : string = '';
    // Pour animations d'affichages
    this.isLoading = true;
    this.error = null;

    // Supprimer les markers d'une précédente recherche avant d'ajouter les nouveaux
    if (this.markers.length > 0) {
      this.clearMarkers(); 
    }

    // Utilisation de l'API Nominatim pour rechercher les POIs autour de la position
    // paramètres : 
    //  latitude, 
    //  longitude, 
    //  nom de la ville, 
    //  nombre maximum de résultats
    this.poiFinder.searchPOIsbyNominatim(this.position.lat, this.position.lon, this.searchQuery, this.limit).subscribe({
      next: (pois) => {
        // Mémorise la liste de POIs trouvés pour les utiliser plus loin
        this.pois = pois;
        if (pois.length > 0) {
          // Ajoute un marker pour chaque POI trouvé
          pois.forEach(element => {
            this.addMarker(element.lat, element.lon, this.mcdoIcon, element.extratags, element.id || 0 ); // Ajouter un marker pour chaque POI trouvé
          });
          // Centrer la carte sur le premier POI trouvé
          const firstPoi = pois[0];
          this.map.setView([firstPoi.lat, firstPoi.lon], 11);
        }

        // Indiquer que la recherche est terminée et déclencher la détection de changement pour mettre à jour l'interface utilisateur
        this.isLoading = false;
        // Déclencher la détection de changement pour mettre à jour l'interface utilisateur
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
  // Ajouter un marker pour chaque POI trouvé avec une popup contenant les détails du POI (adresse, horaires, site web, téléphone, etc.)
  // Paramètres :
  //  latitude, 
  //  longitude,
  //  icône personnalisée pour McDonald's,
  //  les extratags contenant les détails du POI (adresse, horaires, site web, téléphone, etc.)
  //  l'id du POI pour l'afficher dans la popup et le tooltip
  addMarker(lat: number, lng: number, mkr: L.Icon, extratags: any, id: number): void {
    // console.log('extratags: ', extratags);

    // Ajouter un nouveau marker
    const newMarker = L.marker([lat, lng], { icon: mkr })
      .addTo(this.map)
      // Ajoute une popup avec les détails du POI (adresse, horaires, site web, téléphone, etc.)
      .bindPopup(`${id}. ${this.pois[id-1]?.name || 'POI'} 
                        - ${this.pois[id-1]?.address || 'Adresse non disponible'}<br>
                        ${extratags.website ? `<a href="${extratags.website}" target="_blank">Site web</a><br>` : '<span>Site web non disponible</span><br>'}
                         Tél: ${extratags.phone}<br>
                         Horaires: ${extratags.hours}<br>
                         <small>Coordonnées: Lat: ${lat}, Lon: ${lng}</small>`)
      // et un tooltip avec le numéro du POI  
      .bindTooltip(`N° ${id}`, 
        { permanent: false, // s'affiche seulement quand le pointeur de la souris est au-dessus du marker ('mouse over')
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
