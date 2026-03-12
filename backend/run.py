import os
import sys

# Auto-relaunch with the venv Python if running under the wrong interpreter
_venv_python = os.path.join(os.path.dirname(__file__), "venv", "bin", "python")
if os.path.isfile(_venv_python) and os.path.realpath(sys.executable) != os.path.realpath(_venv_python):
    os.execv(_venv_python, [_venv_python] + sys.argv)

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5210, debug=app.config.get("FLASK_DEBUG", False), threaded=True)
