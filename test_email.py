import smtplib
import ssl

def test_login(user, password):
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(user, password)
            print(f"Login SUCCESS for password ending in {password[-4:]}")
    except Exception as e:
        print(f"Login FAILED for password ending in {password[-4:]}: {e}")

user = "harasameeraj.7@gmail.com"
test_login(user, "lgimwesttybpysru")
test_login(user, "ctdvqharberdaodg")
