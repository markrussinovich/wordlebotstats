# Quickstart Guide: Wordle Stat Explorer

## Extension Installation & Setup

### Installation Process
1. **Install from Edge Web Store** 
   - Navigate to Microsoft Edge Add-ons store
   - Search for "Wordle Stat Explorer"
   - Click "Get" and confirm installation
   - Extension icon appears in browser toolbar

2. **Grant Permissions**
   - Click extension icon to open popup  
   - Review permission request for Wordle website access
   - Click "Allow" to enable automatic data import
   - Or select "Manual Import Only" for privacy-first approach

### First-Time Setup
1. **Choose Import Method**
   ```
   Options:
   - Automatic: Extension reads data from Wordle when you play
   - Manual: Copy/paste or upload your existing statistics  
   - Sample Data: Explore features with demo data first
   ```

2. **Import Historical Data** (if available)
   - Visit your Wordle statistics page while extension is active
   - Extension detects existing game history
   - Review detected games and confirm import
   - Or manually upload exported Wordle data file

3. **Configure Preferences**
   - Select theme: Light, Dark, or System  
   - Choose default time frame for analysis
   - Enable/disable spoiler safety mode
   - Opt in/out of anonymous benchmark contribution

## Core Usage Scenarios

### Daily Quick Check (Popup Interface)
**After completing today's Wordle puzzle:**

1. **View Today's Result**
   - Click extension icon in browser toolbar
   - See today's performance: attempts used, win/loss status
   - Compare to your recent average (7-day, 30-day trends)

2. **Quick Performance Summary**  
   - Win rate for selected period vs national average
   - Average guesses vs national average and WordleBot
   - Current win streak vs your historical maximum
   - Guess distribution mini-chart for last 30 days

3. **Time Frame Selection**
   - Use micro-picker: Last 7 | 30 | 90 | YTD | All-time
   - Instantly see metrics update for chosen period
   - Green/red deltas show improvement vs benchmarks

**Expected Result**: Complete overview in <5 seconds, understand performance context immediately

### Deep Analysis (Dashboard Interface)
**Weekly or monthly performance review:**

1. **Open Full Dashboard**  
   - Click "Open Explorer" from popup
   - Or right-click extension icon → "Open Dashboard"
   - Dashboard opens in new tab with comprehensive analysis

2. **Explore Trends Tab**
   - View win rate over time (line charts with trend lines)
   - Analyze average guesses progression  
   - Identify patterns: day-of-week effects, seasonal changes
   - Toggle between raw data and rolling averages

3. **Distribution Analysis**
   - Examine guess distribution (how often you solve in 1-6 tries)
   - Compare your distribution to national percentiles
   - Identify strengths: are you efficient or lucky?
   - View fail distribution patterns

4. **Head-to-Head Comparisons** 
   - "You vs National" scatter plot by puzzle difficulty
   - "Beat WordleBot" analysis: how often you're more efficient
   - Per-puzzle comparison heatmap
   - Filter by time periods or Hard Mode only

**Expected Result**: 5-10 minute analysis session reveals actionable insights about skill progression

### Data Management
**Monthly data maintenance and export:**

1. **Export Personal Data**
   - Navigate to Data & Settings tab
   - Choose export format: JSON (complete) or CSV (statistics)  
   - Select date range or export all historical data
   - Download file for backup or external analysis

2. **Import External Data**
   - Use "Import Data" if switching devices or browsers
   - Support for Wordle Archive exports, manual CSV files
   - Preview import before confirming to avoid duplicates
   - Merge strategies: replace, append, or skip conflicts

3. **Privacy Management**
   - Review benchmark contribution settings
   - See what anonymous data is shared (aggregated statistics only)
   - Clear all data with confirmation if needed
   - Export before clearing for backup purposes

**Expected Result**: Full control over personal data with easy backup/restore

## Integration with Wordle Gameplay

### Seamless Game Import
**While playing Wordle:**

1. **Automatic Detection**
   - Visit nytimes.com/games/wordle as usual
   - Complete puzzle normally (no behavior change needed)
   - Extension content script detects completion state
   - Game result automatically imported to your stats

2. **Import Confirmation**
   - Optional toast notification: "Today's result added!"
   - Click to view quick stats update
   - Or continue playing without interruption
   - Data immediately available in popup/dashboard

### Privacy-First Alternative
**For users preferring manual control:**

1. **Manual Import Prompt**
   - Subtle ribbon appears after puzzle completion
   - "Add to your stats?" with one-click import
   - Dismiss if not wanted for this session
   - No automatic data collection without consent

## Troubleshooting Common Scenarios

### Missing Historical Data
**Problem**: Extension shows only recent games
**Solution**:
1. Visit Wordle statistics page while extension is active
2. Or manually import from external Wordle tracking tools
3. Use "Import from CSV" with formatted game history
4. Contact support for assistance with bulk historical import

### Benchmark Comparison Gaps
**Problem**: "N/A" shown for national averages on certain dates
**Solution**:
1. Normal for very recent puzzles (data processing delay)
2. Expand time range to see coverage percentage
3. Use alternative benchmark (WordleBot vs National)
4. Check Data & Settings for benchmark update status

### Performance Issues
**Problem**: Dashboard loads slowly or popup is laggy
**Solution**:
1. Check extension permissions are properly granted
2. Clear extension data cache from Settings
3. Export data, reinstall extension, re-import data
4. Reduce data retention period in preferences

### Sync Problems
**Problem**: Data not syncing across devices  
**Solution**:
1. Verify Chrome/Edge sync is enabled in browser
2. Export data from old device, import to new device
3. Check extension sync permissions
4. Use manual backup/restore as alternative

## Success Validation

### After Installation (5 minutes)
- [ ] Extension icon visible in toolbar
- [ ] Popup opens and shows basic interface  
- [ ] Permissions granted or manual import selected
- [ ] Sample data loads or first game imports successfully

### After First Week (daily usage)
- [ ] Games automatically import after completion
- [ ] Popup shows meaningful statistics trends
- [ ] Comparison deltas are calculated correctly  
- [ ] Dashboard provides deeper insights than basic Wordle stats

### After First Month (established usage)
- [ ] Clear patterns emerge in trend analysis
- [ ] Benchmark comparisons show statistically significant insights
- [ ] Data export/import works for backup purposes
- [ ] Extension becomes integral to Wordle routine

## Advanced Features Discovery

### Power User Features
- Custom date range analysis for specific puzzle series
- Hard Mode vs Normal Mode comparison views
- Statistical significance testing for improvement claims
- Calendar heat map with puzzle difficulty correlation
- Export formatted charts for social sharing

### Accessibility Features  
- Full keyboard navigation through all interfaces
- High contrast mode with system theme detection
- Screen reader support for chart data tables
- Reduced motion respect for animations
- Text scaling compatibility

### Performance Optimization
- Local data processing (no cloud dependencies)
- Intelligent caching for instant popup responses  
- Progressive loading for large datasets in dashboard
- Background processing for statistics calculations
- Offline functionality with cached benchmark data