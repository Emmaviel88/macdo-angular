import { Component, OnInit, AfterViewInit } from '@angular/core';
import * as L from 'leaflet';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-map',
  imports: [FormsModule],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class Map implements OnInit, AfterViewInit {
  private map!: L.Map;
  searchQuery: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initMap();
  }

  private initMap(): void {
    // Coordonnées de Paris par défaut
    const paris = { lat: 48.8566, lng: 2.3522 };
    // const tendon = {lat: 48.1295499, lng: 6.6753083};

    // Initialisation de la carte
    this.map = L.map('map').setView(paris, 13);

    // Ajout de la couche OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Ajout d'un marqueur
    L.marker(paris).addTo(this.map)
      .bindPopup('Bienvenue à Paris !')
      .openPopup();
  }  

  search(): void {
    if(!this.searchQuery.trim()) return;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.searchQuery)}`;

    this.http.get<any []>(url).subscribe({
      next: (results) => {
        if(results && results.length >0) {
          const lat = parseFloat(results[0].lat);
          const lon = parseFloat(results[0].lon);
          this.map.setView([lat, lon], 13);
          L.marker([lat, lon]).addTo(this.map)
            .bindPopup(`Vous êtes ici : ${this.searchQuery}. [lat: ${lat}, lon: ${lon}]`)
            .openPopup();
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
}
