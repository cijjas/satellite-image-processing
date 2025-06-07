import streamlit as st
import pandas as pd
import plotly.express as px

# Load data
df = pd.read_json('../output/dashboard/time_series_stats.json')

# Title
st.title('Crop Monitoring Dashboard')

# Select metric to plot
metrics = [c for c in df.columns if '_mean' in c or c.startswith('area_')]
metric = st.selectbox('Select metric to plot:', metrics)

# Plot
fig = px.line(df, x='date', y=metric, title=f'{metric} over Time')
st.plotly_chart(fig)
