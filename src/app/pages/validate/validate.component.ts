import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { ConfigService } from '../../services/config.service';

@Component({
    selector: 'app-validate',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSelectModule,
        MatCheckboxModule,
        MatRadioModule,
        MatIconModule,
        MatProgressBarModule,
        MatChipsModule,
        MatDividerModule,
        MatAutocompleteModule,
        MatSnackBarModule,
        MatTooltipModule
    ],
    templateUrl: './validate.component.html',
    styleUrls: ['./validate.component.css']
})
export class ValidateComponent implements OnInit {
    xmlContent: string = '';
    validationMode: string = 'Full 1-5';
    messageType: string = 'Auto-detect';
    storeHistory: boolean = true;
    isLoading: boolean = false;
    report: any = null;
    selectedIssue: any = null;
    lineNumbers: number[] = [1];
    highlightTop: number = 0;
    showHighlight: boolean = false;

    messageControl = new FormControl('Auto-detect');
    filteredOptions: Observable<string[]> | undefined;

    allMessageTypes: string[] = ['Auto-detect'];
    private standardMXTypes: string[] = [
        'pacs.008.001.08 (Local/Cross-Border Credit Transfer)',
        'pacs.009.001.08 (FI Credit Transfer)',
        'pacs.002.001.10 (Payment Status Report)',
        'pacs.004.001.09 (Return)',
        'camt.053.001.08 (Statement)',
        'camt.052.001.08 (Report)',
        'camt.054.001.08 (Notification)',
        'camt.029.001.09 (Investigation)',
        'pain.001.001.09 (Initiation)',
        'pain.002.001.10 (Status Report)',
        'pain.008.001.08 (Direct Debit)',
        'head.001.001.02 (AppHdr)'
    ];

    popularMessages: string[] = [
        'Auto-detect',
        'pacs.008.001.08 (Local/Cross-Border Credit Transfer)',
        'camt.053.001.08 (Statement)',
        'pain.001.001.09 (Initiation)'
    ];

    constructor(
        private http: HttpClient,
        private route: ActivatedRoute,
        private snackBar: MatSnackBar,
        private config: ConfigService
    ) {
        // Initialize with standard types immediately
        this.allMessageTypes = ['Auto-detect', ...this.standardMXTypes];
    }

    ngOnInit() {
        // 1. Check for reportId in query params (passed from History page)
        this.route.queryParams.subscribe(params => {
            const reportId = params['reportId'];
            if (reportId) {
                this.loadHistoricalReport(reportId);
            }
        });

        // 2. Fetch dynamic message list from backend and merge with standard ones
        this.http.get<string[]>(this.config.getApiUrl('/messages')).subscribe({
            next: (data) => {
                // Merge, filter out duplicates, and keep Auto-detect at top
                const combined = [...new Set([...this.standardMXTypes, ...data])].sort();
                this.allMessageTypes = ['Auto-detect', ...combined];
                // Re-trigger filter
                this.messageControl.updateValueAndValidity();
            },
            error: (err) => {
                console.warn('Could not fetch message types, using standard list', err);
            }
        });

        this.filteredOptions = this.messageControl.valueChanges.pipe(
            startWith(''),
            map(value => this._filter(value || '')),
        );

        // Sync local model with control
        this.messageControl.valueChanges.subscribe(val => {
            if (val) this.messageType = val.split(' ')[0];
        });
    }

    loadHistoricalReport(id: string) {
        this.isLoading = true;
        this.http.get<any>(this.config.getApiUrl(`/history/${id}`)).subscribe({
            next: (data) => {
                this.report = data.report;
                this.xmlContent = data.original_message;
                this.updateLineNumbers();
                this.isLoading = false;
            },
            error: (err) => {
                console.error("Failed to load historical report:", err);
                this.isLoading = false;
            }
        });
    }

    getMessageFamily(option: string): any {
        const family = option.split('.')[0].toLowerCase();
        if (option === 'Auto-detect') return { icon: 'auto_awesome', color: '#6366f1' };
        if (family === 'pacs') return { icon: 'account_balance', color: '#10b981' };
        if (family === 'camt') return { icon: 'analytics', color: '#f59e0b' };
        if (family === 'pain') return { icon: 'payments', color: '#ef4444' };
        if (family === 'head') return { icon: 'info', color: '#64748b' };
        return { icon: 'insert_drive_file', color: '#94a3b8' };
    }

    private _filter(value: string): string[] {
        const filterValue = value.toLowerCase();
        return this.allMessageTypes.filter(option =>
            option.toLowerCase().includes(filterValue)
        );
    }

    onFileSelected(event: any) {
        const file: File = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e: any) => {
                this.xmlContent = e.target.result;
                this.updateLineNumbers();
            };
            reader.readAsText(file);
        }
    }

    updateLineNumbers() {
        const lines = this.xmlContent.split('\n').length;
        this.lineNumbers = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);
    }

    onTextareaScroll(event: any) {
        const gutter = document.getElementById('line-gutter');
        if (gutter) {
            gutter.scrollTop = event.target.scrollTop;
        }
    }

    formatXML() {
        if (!this.xmlContent || !this.xmlContent.trim()) return;

        let formatted = '';
        let indent = 0;
        const tab = '  ';

        try {
            // Split into tags and content parts using markers
            const parts = this.xmlContent
                .replace(/>\s*</g, '><') // normalize spaces between tags
                .replace(/</g, '~@~<')
                .replace(/>/g, '>~@~')
                .split('~@~');

            parts.forEach(part => {
                const trimmed = part.trim();
                if (!trimmed) return;

                if (trimmed.match(/^<\/\w/)) {
                    // Closing Tag
                    indent = Math.max(0, indent - 1);
                    formatted += tab.repeat(indent) + trimmed + '\n';
                } else if (trimmed.match(/^<\w[^>]*[^\/]>$/) && !trimmed.startsWith('<?') && !trimmed.startsWith('<!')) {
                    // Opening Tag (not self-closing, not declaration/comment)
                    formatted += tab.repeat(indent) + trimmed + '\n';
                    indent++;
                } else {
                    // Content or self-closing tag or declaration
                    formatted += tab.repeat(Math.max(0, indent)) + trimmed + '\n';
                }
            });

            this.xmlContent = formatted.trim();
            this.updateLineNumbers();
        } catch (e) {
            console.error('Formatting error:', e);
        }
    }

    runValidation() {
        if (!this.xmlContent.trim()) return;

        this.isLoading = true;
        this.report = null;
        this.selectedIssue = null;

        // Use the control value if set, otherwise default
        const selectedType = this.messageControl.value || this.messageType;
        // Strip description for API if needed, or backend handles "Auto-detect"
        const cleanType = selectedType === 'Auto-detect' ? 'Auto-detect' : selectedType?.split(' ')[0];

        this.http.post(this.config.getApiUrl('/validate'), {
            xml_content: this.xmlContent,
            mode: this.validationMode,
            message_type: cleanType,
            store_in_history: this.storeHistory
        }).subscribe({
            next: (data: any) => {
                this.report = data;
                this.isLoading = false;
                this.snackBar.open('Validation Complete', 'Close', { duration: 3000 });
            },
            error: (err) => {
                console.warn("Backend unavailable, switching to DEMO MODE", err);
                this.snackBar.open('Backend Unreachable. Running in Offline Demo Mode.', 'OK', {
                    duration: 5000,
                    panelClass: ['warning-snackbar']
                });
                this.runDemoValidation();
            }
        });
    }

    runDemoValidation() {
        // Simulate network delay
        setTimeout(() => {
            this.report = {
                validation_id: "VAL-DEMO-" + Math.floor(Math.random() * 10000),
                timestamp: new Date().toISOString(),
                status: "FAIL",
                schema: "SR2025",
                message: "pacs.008.001.08",
                errors: 3,
                warnings: 2,
                total_time_ms: 285,
                layer_status: {
                    1: { status: "✅", time: 6 },
                    2: { status: "✅", time: 43 },
                    3: { status: "❌", time: 120 },
                    4: { status: "⏭", time: 0 },
                    5: { status: "⏭", time: 0 }
                },
                details: [
                    {
                        severity: "ERROR",
                        layer: 3,
                        code: "E001",
                        path: "CdtrAgt.FinInstnId.PstlAdr.TwnNm",
                        message: "Town name mandatory for post-Nov 2026 messages",
                        fix_suggestion: "Add <TwnNm>London</TwnNm> to creditor agent address",
                        related_test: "REG-025"
                    },
                    {
                        severity: "ERROR",
                        layer: 2,
                        code: "REG-002",
                        path: "10",
                        message: "Malformed XML structure",
                        fix_suggestion: "Check closing tags",
                        related_test: "REG-002"
                    },
                    {
                        severity: "WARNING",
                        layer: 4,
                        code: "W005",
                        path: "PmtId.InstrId",
                        message: "Instruction ID is unusually long",
                        fix_suggestion: "Limit to 35 characters",
                        related_test: "UAT-103"
                    }
                ]
            };
            this.isLoading = false;
            console.warn("⚠️ Backend not connected. Running in DEMO MODE with sample data.");
            // alert("⚠️ Backend not connected. Running in DEMO MODE with sample data.");
        }, 1500);
    }

    selectIssue(issue: any) {
        if (this.selectedIssue === issue) {
            this.selectedIssue = null;
        } else {
            this.selectedIssue = issue;
        }
    }

    copyToClipboard(text: string) {
        navigator.clipboard.writeText(text).then(() => {
            this.snackBar.open('Copied to clipboard!', 'Dismiss', { duration: 2000 });
        }).catch(err => {
            console.error('Could not copy text: ', err);
            this.snackBar.open('Failed to copy text', 'Close', { duration: 3000 });
        });
    }

    scrollToLine(lineInfo: any) {
        const lineNum = parseInt(lineInfo);
        if (isNaN(lineNum)) return;

        const textarea = document.querySelector('.xml-editor') as HTMLTextAreaElement;

        if (textarea) {
            textarea.focus();

            const lineHeight = 24;
            const paddingTop = 20;
            const scrollPos = (lineNum - 1) * lineHeight;

            // 1. Scroll the entire PAGE and center the editor card on screen
            const card = document.getElementById('editor-card');
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            // 2. Center the line inside the editor: Editor is 500px high, so 250px is middle.
            const targetScroll = Math.max(0, scrollPos - 220);

            textarea.scrollTo({
                top: targetScroll,
                behavior: 'smooth'
            });

            // Keep the highlight bar perfectly synced during the smooth scroll
            const updateHighlight = () => {
                this.highlightTop = paddingTop + (lineNum - 1) * lineHeight - textarea.scrollTop;
                this.showHighlight = true;
            };

            // Run sync every 5ms for 2 seconds to cover both page and textarea scrolls
            const syncTimer = setInterval(updateHighlight, 5);

            setTimeout(() => {
                clearInterval(syncTimer);
                // Keep the highlight bar visible for 5 extra seconds
                setTimeout(() => {
                    this.showHighlight = false;
                }, 5000);
            }, 2000);
        }
    }

    getReportLayers(): string[] {
        if (!this.report?.layer_status) return [];
        return Object.keys(this.report.layer_status).sort();
    }

    getLayerIcon(layer: any) {
        const status = this.report?.layer_status[layer]?.status;
        return status === '✅' ? 'check_circle' : (status === '❌' ? 'cancel' : 'skip_next');
    }

    getLayerColor(layer: any) {
        const status = this.report?.layer_status[layer]?.status;
        return status === '✅' ? '#2e7d32' : (status === '❌' ? '#d32f2f' : '#9e9e9e');
    }

    clearAll() {
        this.xmlContent = '';
        this.report = null;
        this.selectedIssue = null;
    }
}
