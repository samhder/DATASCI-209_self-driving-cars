# DATASCI 209 flask template

This repo provides a basic flask app for DATASCI 209 students and instructors. You can run this flask app locally for development/debugging or deploy it to [Vercel](https://vercel.com).

*Note there is a size limitatinon of 250MB*, this means you have the careful with which POython libraries you include alongside `Flask` (e.g., `sklearn` is too big).

## Getting Started

1. Install Python 3.x on your computer.
2. [Create a copy](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template#creating-a-repository-from-a-template) of this repo in your personal GitHub workspace. For example, if your GitHub username is **octocat**, you would make octocat the owner of your copy of the repository.
3. Clone your copy of this repo from GitHub to your computer.

## Local Development

**Install dependencies**

Open a terminal and navigate to the folder that contains your local copy of this repo.  Run the following command to install the necessary Python libraries:

**Mac**
```
pip3 install -r requirements.txt
```

**Windows**
```
py -m pip install -r requirements.txt
```

See the [pip documentation](https://pip.pypa.io/en/stable/cli/pip_install/) if you need more information about installing Python libraries with pip.

**Run your app locally**

In the folder where you cloned a copy of this repo, run the following command.  The --debug option will cause flask to automatically load any code changes you make.

```
flask --app app.py --debug run
```

**Point your browser to http://127.0.0.1:5000**

When running your app locally with the --debug flag, flask's built-in debugger will provide an interactive traceback in your browser.  You can also use an external debugger such as the one in your preferred IDE to troubleshoot your code.  See the flask [Debugging Application Errors](https://flask.palletsprojects.com/en/stable/debugging/) documentation for more information on debugging your flask app.

## Hosting your flask app on Vercel

Vercel provides a cloud platform that you can use to host your flask app for free (with generous limits on the hobby tier).

**How to deploy your flask app to Vercel**

1. Create a [Vercel](https://vercel.com) account. You can sign up with your GitHub account for easy integration.

2. From the Vercel dashboard, click **Add New...** → **Project**.

3. Select **Import Git Repository** and choose your fork of this flask template repository.
   - If you don't see your repository, click **Adjust GitHub App Permissions** to grant Vercel access to the repo.

4. Vercel will automatically detect the project settings from the `vercel.json` file. You don't need to change any settings.

5. Click **Deploy**. Vercel will build and deploy your application.

6. Once deployment completes, Vercel will provide you with a URL for your app (e.g., `https://your-project-name.vercel.app`).

**Automatic Deployments**

Every time you push changes to the main branch of your GitHub repository, Vercel will automatically rebuild and deploy your app. You can also create preview deployments by pushing to other branches or creating pull requests.

**Custom Domains**

You can add a custom domain to your Vercel project from the project settings. See Vercel's [Custom Domains documentation](https://vercel.com/docs/concepts/projects/domains) for more information.

**Troubleshooting**

- Check the **Deployments** tab in your Vercel project dashboard to view build logs and identify any errors.
- See Vercel's [Python documentation](https://vercel.com/docs/functions/runtimes/python) for more details on Python runtime support.
- Visit Vercel's [Support page](https://vercel.com/support) if you need additional help.

**Important Notes**

- Vercel's free hobby tier includes generous limits for personal projects and learning.
- The `vercel.json` file in this repo configures the Python runtime and routing for Flask.
- Static files in the `static/` folder are served automatically.
