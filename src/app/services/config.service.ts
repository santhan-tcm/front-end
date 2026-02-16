import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  private readonly localUrl = 'http://127.0.0.1:8001';
  // private readonly productionUrl = 'https://backend-python-production-0cc8.up.railway.app';
  private readonly productionUrl = 'https://backend-hgdv.onrender.com';

  getApiUrl(path: string): string {

    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    const base = isLocal ? this.localUrl : this.productionUrl;

    return `${base}${path}`;
  }
}
