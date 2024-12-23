from flask import Flask, render_template, request, jsonify
from datetime import datetime, timedelta, timezone
import json
import glob
import os

app = Flask(__name__)

MAPS_PER_PAGE = 100  # Show 100 maps per page

def load_classified_maps():
    try:
        with open('classified_maps.json', 'r', encoding='utf-8') as f:
            classified_maps = json.load(f)
            # Create a dictionary with beatmap_id as key for faster lookups
            return {str(map_data['beatmap_id']): map_data['predicted_type'] for map_data in classified_maps}
    except FileNotFoundError:
        return {}

def get_latest_results(page=1, limit=MAPS_PER_PAGE):
    files = glob.glob('farm_maps_*.json')
    if not files:
        return [], 0
    
    latest_file = max(files, key=os.path.getctime)
    classified_maps_dict = load_classified_maps()
    
    with open(latest_file, 'r', encoding='utf-8') as f:
        all_results = json.load(f)
        total_maps = len(all_results)
        
        if limit is None:
            results = all_results
        else:
            start_idx = (page - 1) * limit
            end_idx = start_idx + limit
            results = all_results[start_idx:end_idx]
        
        filtered_results = []
        for result in results:
            # Round base BPM first
            result['bpm'] = round(result['bpm'])
            
            # Adjust and round BPM for DT/NC
            if "'DT'" in result['mods'] or "'NC'" in result['mods']:
                result['bpm'] = round(result['bpm'] * 1.5)
            
            base_length = result['length']
            adjusted_length = round(base_length / 1.5) if "'DT'" in result['mods'] or "'NC'" in result['mods'] else base_length
            minutes = adjusted_length // 60
            seconds = adjusted_length % 60
            result['formatted_length'] = f"{minutes}:{seconds:02d}"
            
            result['formatted_accuracy'] = f"{result['average_accuracy']:.2f}%"
            
            mods_str = result['mods'].strip("[]'").replace("', '", " ")
            result['mods'] = mods_str
            
            # Add map type from classified_maps.json
            result['map_type'] = classified_maps_dict.get(str(result['beatmap_id']), 'unknown')
            
            filtered_results.append(result)
            
        return filtered_results, total_maps

@app.route('/')
def index():
    page = request.args.get('page', 1, type=int)
    results, total_maps = get_latest_results(page)
    total_pages = (total_maps + MAPS_PER_PAGE - 1) // MAPS_PER_PAGE
    
    return render_template('index.html', 
                         maps=results, 
                         current_page=page, 
                         total_pages=total_pages,
                         MAPS_PER_PAGE=MAPS_PER_PAGE)

@app.route('/load_more')
def load_more():
    page = request.args.get('page', 1)
    if page == 'all':
        # Return all maps for filtering
        results, _ = get_latest_results(page=1, limit=None)
        return jsonify(results)
    
    # Return paginated results for initial load
    page = int(page)
    results, _ = get_latest_results(page=page)
    return jsonify(results)

if __name__ == '__main__':
    # Use PORT environment variable if available, otherwise default to 5000
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port) 