# HQBMS - Scoring & Prediction Engine Specification

The HQBMS Prediction Engine provides highly accurate Wait Time Estimates for OPD patients. It utilizes a **Hybrid System**, blending a fast, context-aware Moving Average (stored in Redis) with a historical Machine Learning prediction (GBDT/RF).

## 1. Hybrid Prediction Formula

```
final_estimate = (ml_weight × ml_prediction) + (ma_weight × moving_average_estimate)
```
- **ml_weight:** Default `0.60`. (Can be dynamically adjusted in Redis).
- **ma_weight:** Default `0.40`. 
- Overrides: If less than 5 consultations exist today, system falls back to `100% ML`. If the ML service goes offline, system falls back to `100% Moving Average`.

## 2. Moving Average Engine (Redis)
The moving average engine reacts instantly to real-world pacing (e.g., a doctor taking slightly longer than usual due to a complex case).

### Data Structure
- **Key:** `queue:{deptId}:window` (List)
- Maintains only the last 5 completed consultation durations in seconds using `RPUSH` and `LTRIM -5 -1`.
- **Key:** `queue:{deptId}:avg` (String)
- Caches the calculated mean of the window.

### Calculation
```js
async function estimateWait(deptId, position) {
  const avg = await redis.get(`queue:${deptId}:avg`) || 600; // 10min fallback
  return Math.round(position * avg / 60); // return minutes
}
```

## 3. Machine Learning Microservice

### Model Selection
- Uses **Gradient Boosting Decision Trees (GBDT)** and **Random Forest (RF)** models implemented via `scikit-learn`.
- Pickled via `joblib` and served over a FastAPI endpoint (`/predict/waittime`).

### Feature Engineering
Prior to inference, the request payload is vectorized into the following features:

| Rank | Feature | Type | Extraction logic |
|---|---|---|---|
| 1 | `queue_depth_ahead` | Integer | Patients physically ahead in the active queue list. |
| 2 | `registration_hour` | Int 0-23 | Extracted from `registered_at` timestamp. Provides cyclical load context. |
| 3 | `day_of_week` | One-Hot (7) | E.g. Mondays are traditionally busier. |
| 4 | `visit_type` | Binary | 1 = Appointment, 0 = Walk-in. |
| 5 | `turn_missed_flag` | Binary | 1 = Patient missed their turn previously today. |
| 6 | `gender` | Binary | 1 = Male, 0 = Female |
| 7 | `payment_type` | Binary | 1 = Insurance, 0 = Self-pay |
| 8 | `registration_day` | Int 1-31 | Identifies end/start of month surges. |

### Training Pipeline
1. Extracts the last 90 days of `queue_entries` where `ended_at IS NOT NULL`.
2. Computes the actual duration `ended_at - registered_at`.
3. 80/20 train-test split with GridSearchCV hyperparameter tuning.
4. Target metric: Mean Absolute Error (MAE) < 15 minutes.
5. Retrained weekly via a scheduled GitHub Action cron job (`python ml_service/train.py`).

## 4. Bed Occupancy Threshold Alerting (Secondary Scoring)
An independent Postgres-level scoring function monitors ICU bed safety caps.

- **Trigger:** Fires on `UPDATE` to the `beds` table.
- **Logic:** `pct = total_occupied / total_beds`
- **Threshold:** If `pct >= 0.85` (85%), an asynchronous HTTP call (`pg_net`) pushes a severity notification to Novu, warning the Hospital Admin of imminent bed exhaustion.
