import Mailgen from "mailgen";
import nodemailer from "nodemailer";

export const sendMail = async (options) => {
  const mailGenerator = new Mailgen({
    theme: "default",
    product: {
      name: "Task Manager",
      link: "testlink",
    },
  });
  // Generate an HTML email with the provided contents
  var emailBody = mailGenerator.generate(options.mailGenContent);

  // Generate the plaintext version of the e-mail (for clients that do not support HTML)
  var emailText = mailGenerator.generatePlaintext(options.mailGenContent);

  var transport = nodemailer.createTransport({
    host: process.env.MAILTRAP_HOST,
    port: process.env.MAILTRAP_PORT,
    secure: false,
    auth: {
        user: process.env.MAILTRAP_USERNAME,
        pass: process.env.MAILTRAP_PASSWORD
    }
  });

  await transport.sendMail({
    from: process.env.MAILTRAP_MAIL, // sender address
    to: options.email, // list of receivers
    subject: options.subject, // Subject line
    html: emailBody,
    text: emailText,
  });
};
    




export const emailVerificationMailGenContent = (username, verificationURL, URLExpiry) => {
  return {
    body: {
      name: username,
      intro: `Click on below link before ${URLExpiry} to verify your email: `,
      action: {
        button: {
          color: "#22BC66", // optional
          text: "Confirm your account",
          link: verificationURL,
        },
      },
      outro:
        "Need help, or have questions? Just reply to this email, we'd love to help.",
    },
  };
};

export const forgotPasswordMailGenContent = (username, url, URLExpiry) => {
  return {
    body: {
      name: username,
      intro: `Click on the link to reset your password before ${URLExpiry}`,
      action: {
        button: {
          color: "#22BC66", // optional
          text: "Reset your Password",
          link: url,
        }
      },
      outro: "Not You? Someone might have mistakingly entered your mail. Please, Ignore the mail in such case."
    }
  }
}