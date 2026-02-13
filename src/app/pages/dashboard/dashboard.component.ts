import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../../services/config.service';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, RouterModule],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
    stats = {
        total: 0,
        passed: 0,
        failed: 0,
        efficiency: '0%'
    };

    recentActivity: any[] = [];

    constructor(
        private http: HttpClient,
        private config: ConfigService
    ) { }

    ngOnInit() {
        this.loadStats();
    }

    loadStats() {
        this.http.get<any[]>(this.config.getApiUrl('/history')).subscribe({
            next: (data) => {
                this.stats.total = data.length;
                this.stats.passed = data.filter(r => r.status === 'PASS').length;
                this.stats.failed = data.filter(r => r.status === 'FAIL').length;
                this.stats.efficiency = this.stats.total > 0 ?
                    Math.round((this.stats.passed / this.stats.total) * 100) + '%' : '100%';

                this.recentActivity = data.slice(0, 5);
            },
            error: (err) => console.error('Dashboard failed to load history:', err)
        });
    }
}
