from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def w209():
    return render_template('w209.html')

@app.route('/nhtsa-adas-ads')
def nhtsa_adas_ads():
    return render_template('nhtsa_adas_ads.html')

@app.route('/nhtsa-adas-ads-traffic')
def nhtsa_adas_ads_traffic():
    return render_template('nhtsa_adas_ads_traffic.html')

@app.route('/rain-check')
def rain_check():
    return render_template('rain_check.html')

if __name__ == '__main__':
    app.run()
