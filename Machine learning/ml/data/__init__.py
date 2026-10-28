"""
Data Package for ReportSetu (ML 2).
Provides synthetic datasets, 5 demo patients, and evaluation benchmarks.
"""

from .demo_patients import get_demo_patients, save_demo_patients_json
from .synthetic_generator import generate_synthetic_dataset, generate_and_save_split_datasets
from .evaluate_models import run_evaluation

__all__ = [
    "get_demo_patients",
    "save_demo_patients_json",
    "generate_synthetic_dataset",
    "generate_and_save_split_datasets",
    "run_evaluation",
]
