/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { screen, fireEvent, waitFor } from "@testing-library/dom";
import NewBillUI from "../views/NewBillUI.js";
import mockedStore from "../__mocks__/store";
import NewBill from "../containers/NewBill.js";
import { ROUTES_PATH } from "../constants/routes.js";
import { localStorageMock } from "../__mocks__/localStorage.js";
import router from "../app/Router.js";

jest.mock("../app/Store", () => mockedStore);

const setNewBill = () => {
  return new NewBill({
    document,
    onNavigate: window.onNavigate,
    store: mockedStore,
    localStorage: window.localStorage,
  });
};

describe("Given I am connected as an employee", () => {
  describe("When I am on NewBill Page", () => {
    beforeEach(() => {
      document.body.innerHTML = ""; // Nettoie le DOM avant chaque test
      jest.clearAllMocks(); // Réinitialiser tous les mocks
      Object.defineProperty(window, "localStorage", {
        value: localStorageMock,
      });
      window.localStorage.setItem(
        "user",
        JSON.stringify({
          type: "Employee",
        })
      );
      const root = document.createElement("div");
      root.setAttribute("id", "root");
      document.body.append(root);
      router();
    });
    //Vérifie que le formulaire et le champ de fichier sont correctement rendus dans le DOM.
    test("Then all the form inputs should be rendered correctly", () => {
      const html = NewBillUI();
      document.body.innerHTML = html;

      const formNewBill = screen.getByTestId("form-new-bill");
      expect(formNewBill).toBeInTheDocument();

      const fileInput = screen.getByTestId("file");
      expect(fileInput).toBeInTheDocument();
    });
    //Teste que l'icône de courrier est mise en évidence
    test("Then the mail icon in the vertical layout should be highlighted", async () => {
      window.onNavigate(ROUTES_PATH.NewBill);
      await waitFor(() => screen.getAllByTestId("icon-mail"));
      const icons = screen.getAllByTestId("icon-mail");
      const icon = icons[0];
      expect(icon).toHaveClass("active-icon");
    });

    describe("When I interact with the NewBill form", () => {
      // Vérifie que la validation échoue si un fichier d'un type non valide est soumis et
      //Vérifie que l'utilisateur peut ajouter un fichier valide et que la méthode handleChangeFile est appelée.
      test("Then file validation fails for invalid file types", async () => {
        const newBill = setNewBill();

        const html = NewBillUI();
        document.body.innerHTML = html;

        const invalidFile = new File(["test.pdf"], "test.pdf", {
          type: "application/pdf",
        });

        const fileInput = screen.getByTestId("file");
        const handleChangeFile = jest.fn(newBill.handleChangeFile);

        fileInput.addEventListener("change", handleChangeFile);

        fireEvent.change(fileInput, {
          target: {
            files: [invalidFile],
          },
        });

        expect(fileInput.classList.contains("is-invalid")).toBeTruthy();
        expect(handleChangeFile).toHaveBeenCalled();
      });

      test("Then I can add a file", async () => {
        const newBill = setNewBill();

        const html = NewBillUI();
        document.body.innerHTML = html; // Rendre le formulaire une fois

        // Attendre que l'élément input file soit rendu dans le DOM
        const inputFile = await waitFor(() => screen.getByTestId("file"));
        expect(inputFile).toBeInTheDocument();

        const handleChangeFile = jest.fn(newBill.handleChangeFile);

        inputFile.addEventListener("change", handleChangeFile);

        fireEvent.change(inputFile, {
          target: {
            files: [
              new File(["document.jpg"], "document.jpg", {
                type: "image/jpg",
              }),
            ],
          },
        });

        expect(handleChangeFile).toHaveBeenCalled();
      });
    });
    //Vérifie que la fonction handleSubmit est appelée lors de la soumission du formulaire
    describe("When I submit the form", () => {
      test("Then, the handleSubmit function should be called", () => {
        document.body.innerHTML = NewBillUI();

        const newBill = setNewBill();

        const store = {
          bills: jest.fn(() => newBill.store),
          create: jest.fn(() => Promise.resolve({})),
        };

        newBill.isImgFormatValid = true;

        const formNewBill = screen.getByTestId("form-new-bill");
        const handleSubmit = jest.fn(newBill.handleSubmit);
        formNewBill.addEventListener("submit", handleSubmit);
        fireEvent.submit(formNewBill);

        expect(handleSubmit).toHaveBeenCalled();
      });
    });

    // POST new bill.Vérifie qu'une nouvelle note de frais est correctement ajoutée
    describe("When I submit the form", () => {
      describe("And the form is valid", () => {
        test("Then a new bill is added via the mock API POST", async () => {
          const postSpy = jest.spyOn(mockedStore, "bills");
          const bill = {
            id: "47qAXb6fIm2zOKkLzMro",
            vat: "80",
            fileUrl:
              "https://firebasestorage.googleapis.com/v0/b/billable-677b6.a…f-1.jpg?alt=media&token=c1640e12-a24b-4b11-ae52-529112e9602a",
            status: "pending",
            type: "Hôtel et logement",
            commentary: "séminaire billed",
            name: "encore",
            fileName: "preview-facture-free-201801-pdf-1.jpg",
            date: "2004-04-04",
            amount: 400,
            commentAdmin: "ok",
            email: "a@a",
            pct: 20,
          };
          const postBills = await mockedStore.bills().update(bill);
          expect(postSpy).toHaveBeenCalledTimes(1);
          expect(postBills).toStrictEqual(bill);
        });
      });
      //Vérifie la gestion des erreurs lorsque l'API échoue avec des erreurs 404 ou 500.
      describe("When an error occurs on API", () => {
        test("Then new bill is added to the API but fetch fails with '404 page not found' error", async () => {
          const newBill = setNewBill();

          const mockedBill = jest
            .spyOn(mockedStore, "bills")
            .mockImplementationOnce(() => {
              return {
                create: jest.fn().mockRejectedValue(new Error("Erreur 404")),
              };
            });

          await expect(mockedBill().create).rejects.toThrow("Erreur 404");

          expect(mockedBill).toHaveBeenCalledTimes(1);

          expect(newBill.billId).toBeNull();
          expect(newBill.fileUrl).toBeNull();
          expect(newBill.fileName).toBeNull();
        });

        test("Then new bill is added to the API but fetch fails with '500 Internal Server error'", async () => {
          const newBill = setNewBill();

          const mockedBill = jest
            .spyOn(mockedStore, "bills")
            .mockImplementationOnce(() => {
              return {
                create: jest.fn().mockRejectedValue(new Error("Erreur 500")),
              };
            });

          await expect(mockedBill().create).rejects.toThrow("Erreur 500");

          expect(mockedBill).toHaveBeenCalledTimes(1);

          expect(newBill.billId).toBeNull();
          expect(newBill.fileUrl).toBeNull();
          expect(newBill.fileName).toBeNull();
        });
      });
    });
  });
});
