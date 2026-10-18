from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def w209():
    return render_template('w209.html')

if __name__ == '__main__':
    app.run()
