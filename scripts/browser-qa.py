"""Backward-compatible command: run the current version 3 browser checks."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('browser-v3-qa.py')),run_name='__main__')
