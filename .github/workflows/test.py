import unittest
import requests

class TestSystemInfoJSON(unittest.TestCase):
    def test_json_data(self):
        # Haal JSON-gegevens op van /system_info
        response = requests.get('http://localhost/system_info')  # Pas de URL aan als dat nodig is
        self.assertEqual(response.status_code, 200, "Fout bij het ophalen van JSON-gegevens")

        # Valideer de JSON-gegevens
        data = response.json()

        self.assertTrue(isinstance(data['cpu_usage'], (int, float)), "cpu_usage moet een getal zijn")
        self.assertTrue(isinstance(data['memory_usage'], (int, float)), "memory_usage moet een getal zijn")
        self.assertTrue(isinstance(data['gpu_usage'], (int, float)), "gpu_usage moet een getal zijn")
        self.assertTrue(isinstance(data['gpu_memory_used'], (int, float)), "gpu_memory_used moet een getal zijn")

        # Voeg hier meer validatieregels toe voor andere velden indien nodig

if __name__ == '__main__':
    unittest.main()
